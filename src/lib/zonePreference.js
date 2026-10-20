import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

// "Zona y distancia" (Configuración): un punto y un radio. Si está definida,
// el feed del Inicio muestra solo los eventos dentro de ese radio.
//
// Se guarda en el teléfono y no en users/{uid}: ese doc lo puede leer
// cualquier usuario autenticado (ver firestore.rules), y el pin suele ser la
// casa de la persona. No hace falta que viaje al servidor para filtrar, porque
// el feed ya se filtra en el cliente.
const STORAGE_KEY = 'zonePreference';

export const RADIUS_OPTIONS_KM = [5, 10, 25, 50];
export const DEFAULT_RADIUS_KM = 10;

// zone: { lat, lng, radiusKm } | null (null = todo el país)
let current;          // undefined = todavía no se leyó del storage
const listeners = new Set();

function emit() {
  listeners.forEach(fn => fn(current));
}

async function load() {
  if (current !== undefined) return current;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    current = isValidZone(parsed) ? parsed : null;
  } catch {
    current = null;
  }
  emit();
  return current;
}

function isValidZone(z) {
  return !!z && Number.isFinite(z.lat) && Number.isFinite(z.lng) && Number.isFinite(z.radiusKm) && z.radiusKm > 0;
}

export async function setZonePreference(zone) {
  current = zone && isValidZone(zone) ? { lat: zone.lat, lng: zone.lng, radiusKm: zone.radiusKm } : null;
  emit();
  try {
    if (current) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {}
}

// Devuelve { zone, loaded }. Todas las pantallas montadas se enteran al
// instante cuando se guarda una zona nueva.
export function useZonePreference() {
  const [zone, setZone] = useState(current ?? null);
  const [loaded, setLoaded] = useState(current !== undefined);
  useEffect(() => {
    const fn = z => { setZone(z ?? null); setLoaded(true); };
    listeners.add(fn);
    load().then(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return { zone, loaded };
}

// Distancia en km entre dos puntos (haversine).
export function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Coordenadas de un evento. Propios y externos las tienen en location.lat/lng
// (ver normalizeExternalEvent). Ojo: la mayoría de los externos traen el
// centro de su provincia (PROVINCE_COORDS en functions/index.js), no la
// dirección exacta. Se toman igual: es precisión de provincia, pero sacarlos
// dejaría el feed con zona casi sin eventos externos.
function eventCoords(ev) {
  const l = ev?.location;
  if (!l) return null;
  return Number.isFinite(l.lat) && Number.isFinite(l.lng) ? { lat: l.lat, lng: l.lng } : null;
}

// ¿El evento entra en la zona? Sin zona, todo entra. Los virtuales entran
// siempre (no dependen de dónde esté uno). Los que no tienen coordenadas
// reales no entran: no hay forma de saber si están cerca.
export function isInZone(ev, zone) {
  if (!zone) return true;
  if (ev?.isVirtual) return true;
  const c = eventCoords(ev);
  if (!c) return false;
  return distanceKm(zone.lat, zone.lng, c.lat, c.lng) <= zone.radiusKm;
}

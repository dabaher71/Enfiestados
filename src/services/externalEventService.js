import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Trae hasta maxResults eventos de la colección eventos_externos.
 * Usa getDocs (una sola lectura, sin listener) para evitar fugas de memoria.
 */
export async function fetchExternalEvents(maxResults = 50) {
  const q = query(
    collection(db, 'eventos_externos'),
    orderBy('updatedAt', 'desc'),
    limit(maxResults),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => normalizeExternalEvent(doc.id, doc.data()));
}

/**
 * Dispersión aleatoria pequeña (~0–300 m) para que pines del mismo punto
 * no se solapen exactamente en el mapa.
 */
function jitter() {
  return (Math.random() - 0.5) * 0.005; // ±0.0025° ≈ ±280 m
}

/**
 * Convierte un documento de eventos_externos al shape que usa la app.
 * Añade _isExternal: true para que las pantallas puedan diferenciarlo.
 */
export function normalizeExternalEvent(id, data) {
  // GeoPoint del SDK cliente expone .latitude y .longitude
  const baseLat = data.geopunto?.latitude  ?? 9.9333;
  const baseLng = data.geopunto?.longitude ?? -84.0833;

  // Aplicar jitter solo si las coords son el fallback de provincia
  // (si son exactamente el centro, casi seguro es un fallback)
  const isProvinceCentroid =
    data.geopunto?.latitude  === undefined ||
    data.geopunto?.longitude === undefined;

  const lat = isProvinceCentroid ? baseLat + jitter() : baseLat;
  const lng = isProvinceCentroid ? baseLng + jitter() : baseLng;

  return {
    id,
    _isExternal: true,
    // Campos que usa ExternalEventSearchCard y ExternalEventCard
    title:        data.title        || '',
    imageUrl:     data.imageUrl     || '',
    dateText:     data.dateText     || '',
    locationText: data.locationText || '',
    description:  data.description  || '',
    eventUrl:     data.eventUrl     || '',
    source:       data.source       || '',
    // Fecha ISO para filtro de pasados (null si no se pudo parsear)
    dateISO:      data.dateISO     || null,
    // Alias para que filtros de texto del buscador funcionen
    image:        data.imageUrl    || '',
    date:         data.dateText    || '',
    location: {
      lat,
      lng,
      name: data.locationText || '',
    },
    // category usa la fuente como fallback. isFree NO se asume: si no hay dato, no hay badge
    category:   data.source  || 'Externo',
    isFree:     undefined,   // sin dato de precio → TrailingBadge devuelve null
    price:      undefined,
    likes:      [],
    attendees:  [],
  };
}

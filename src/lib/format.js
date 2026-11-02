// Utilidades de formato — fuente única de verdad para fechas y precios.
// Ninguna pantalla debe formatear fechas por su cuenta (§ 3 del design system).
//
// Los nombres de días/meses y las frases ("hoy", "faltan 3 días") salen del
// idioma de la app (src/i18n, sección "format"). Estas funciones no
// re-renderizan nada: el componente que las usa tiene que llamar a
// useTranslation() para actualizarse al cambiar de idioma.
import i18n from '../i18n';

// Normaliza createdAt: llega como Firestore Timestamp real (escrito por
// Cloud Functions, ej. serverTimestamp()) o como string ISO (escrito por
// el cliente). new Date(Timestamp) no parsea → "Invalid Date" si no se
// distingue. Usar SIEMPRE esto en vez de new Date(campo) directo sobre
// createdAt/lastMessageTime de Firestore.
export const toDate = (v) => (v?.toDate ? v.toDate() : new Date(v));

const list = (key) => i18n.t(key, { returnObjects: true });
const dayShort  = (d) => list('format.daysShort')[d.getDay()];
const dayFull   = (d) => list('format.daysFull')[d.getDay()];
const monthShort = (d) => list('format.monthsShort')[d.getMonth()];
const monthFull  = (d) => list('format.monthsFull')[d.getMonth()];

// Parsea 'DD/MM/YYYY' o ISO string a Date
function parseEventDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  // DD/MM/YYYY
  const slash = String(raw).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) return new Date(+slash[3], +slash[2] - 1, +slash[1]);
  // ISO
  const d = new Date(raw);
  return isNaN(d) ? null : d;
}

// "Sáb 8 ago · 8:00 pm"
export function formatEventDate(rawDate, rawTime) {
  const d = parseEventDate(rawDate);
  if (!d) return rawDate ?? '';
  const time = rawTime ? ` · ${formatTime12(rawTime)}` : '';
  return i18n.t('format.eventDate', { day: dayShort(d), date: d.getDate(), month: monthShort(d) }) + time;
}

// "hace 2 h" | "ayer" | "hoy" | "mañana" | "Sáb 8 ago"
export function formatRelative(rawDate) {
  const d = parseEventDate(rawDate);
  if (!d) return '';
  const now   = new Date();
  const diffMs = d - now;
  const diffH  = diffMs / 3_600_000;
  const diffD  = Math.round(diffMs / 86_400_000);

  if (Math.abs(diffH) < 1)  return i18n.t('format.now');
  if (diffH > 0 && diffH < 24) return i18n.t('format.inHours', { count: Math.round(diffH) });
  if (diffH < 0 && diffH > -24) return i18n.t('format.hoursAgo', { count: Math.round(-diffH) });
  if (diffD === 0)  return i18n.t('format.todayLower');
  if (diffD === 1)  return i18n.t('format.tomorrowLower');
  if (diffD === -1) return i18n.t('format.yesterdayLower');
  return formatEventDate(rawDate);
}

// { day, month } para el badge de fecha de EventCardLarge — "19" / "AGO"
export function formatDateBadge(rawDate) {
  const d = parseEventDate(rawDate);
  if (!d) return null;
  return { day: d.getDate(), month: monthShort(d).toUpperCase() };
}

// "₡8.000" | "Gratis" | "Desde ₡12.000"
export function formatPrice(price, isFree, prefix) {
  if (isFree || price === 0) return i18n.t('common.free');
  const formatted = `₡${Number(price).toLocaleString('es-CR')}`;
  return prefix ? i18n.t('format.fromPrice', { price: formatted }) : formatted;
}

// "Hoy · 8:00 pm" si es hoy; si no, "Sáb 8 ago · 8:00 pm" (formatEventDate).
// FIX_ROUND_5 § 1 — fila de fecha de EventCardLarge.
export function formatCardDate(rawDate, rawTime) {
  const d = parseEventDate(rawDate);
  if (!d) return rawDate ?? '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (d.toDateString() === today.toDateString()) {
    const time = rawTime ? ` · ${formatTime12(rawTime)}` : '';
    return i18n.t('common.today') + time;
  }
  return formatEventDate(rawDate, rawTime);
}

// "1:37 pm" desde "13:37" o "1:37 PM"
function formatTime12(raw) {
  if (!raw) return '';
  const m = String(raw).match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/);
  if (!m) return raw;
  let h = parseInt(m[1], 10);
  const min = m[2];
  let meridiem = m[3] ? m[3].toLowerCase() : (h < 12 ? 'am' : 'pm');
  if (!m[3]) { if (h >= 12) { meridiem = 'pm'; if (h > 12) h -= 12; } else if (h === 0) h = 12; }
  return `${h}:${min} ${meridiem}`;
}

// "faltan 5 días" / "Hoy" / "Mañana" / null si ya pasó
// Acepta 'DD/MM/YYYY' (formato de evento) o ISO.
export function formatDaysUntil(rawDate) {
  const d = parseEventDate(rawDate);
  if (!d) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d - today) / 86400000);
  if (diff < 0)  return null;
  if (diff === 0) return i18n.t('common.today');
  if (diff === 1) return i18n.t('common.tomorrow');
  // Plurales a mano: no dependemos de Intl.PluralRules en Hermes.
  return i18n.t(diff === 1 ? 'format.daysLeftOne' : 'format.daysLeft', { count: diff });
}

// getImages — FIX_ROUND_5 § 6. Lectura retrocompatible del carrusel de un
// evento: usa images[] si existe: si no, cae al campo de una sola imagen
// (nativos escriben 'image', importados escriben 'imageUrl'). Un solo
// helper — no repartir el ?.length ? por las pantallas.
export function getImages(ev) {
  if (ev?.images?.length) return ev.images;
  const single = ev?.imageUrl || ev?.image;
  return single ? [single] : [];
}

// Extrae dominio legible de una URL: "smarticket.net"
export function formatDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url ?? ''; }
}

// Fecha larga: "Lunes 26 de julio del 2026"
export function formatDateLong(rawDate) {
  const d = parseEventDate(rawDate);
  if (!d) return rawDate ?? '';
  return i18n.t('format.dateLong', { day: dayFull(d), date: d.getDate(), month: monthFull(d), year: d.getFullYear() });
}

// Etiqueta del separador de día en el feed (FIX_ROUND_1 § 2.1)
// Devuelve { label, isToday } para que el llamador pueda colorear
// hoy      → { label: "HOY · VIERNES 25",   isToday: true  }
// mañana   → { label: "MAÑANA · SÁBADO 26", isToday: false }
// resto    → { label: "LUNES 28 DE JULIO",  isToday: false }
export function formatDaySeparator(rawDate) {
  const d = parseEventDate(rawDate);
  if (!d) return { label: '', isToday: false };

  const today    = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const vars = { day: dayFull(d), date: d.getDate(), month: monthFull(d) };

  if (d.toDateString() === today.toDateString()) {
    return { label: i18n.t('format.separatorToday', vars).toUpperCase(), isToday: true };
  }
  if (d.toDateString() === tomorrow.toDateString()) {
    return { label: i18n.t('format.separatorTomorrow', vars).toUpperCase(), isToday: false };
  }
  return { label: i18n.t('format.separator', vars).toUpperCase(), isToday: false };
}

// Formatea hora en "8:00 pm" para el overline del EventRow
export function formatTimeShort(rawTime) {
  if (!rawTime) return '';
  const m = String(rawTime).match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/);
  if (!m) return rawTime;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const meridiem = m[3]?.toLowerCase() ?? (h >= 12 ? 'pm' : 'am');
  if (!m[3] && h > 12) h -= 12;
  if (!m[3] && h === 0) h = 12;
  return `${h}:${min} ${meridiem}`;
}

// Utilidades de formato — fuente única de verdad para fechas y precios.
// Ninguna pantalla debe formatear fechas por su cuenta (§ 3 del design system).

const DAYS_ES      = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAYS_FULL_ES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MONTHS_ES    = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_FULL  = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

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
  const dayName = DAYS_ES[d.getDay()];
  const day     = d.getDate();
  const month   = MONTHS_ES[d.getMonth()];
  const time    = rawTime ? ` · ${formatTime12(rawTime)}` : '';
  return `${dayName} ${day} ${month}${time}`;
}

// "hace 2 h" | "ayer" | "hoy" | "mañana" | "Sáb 8 ago"
export function formatRelative(rawDate) {
  const d = parseEventDate(rawDate);
  if (!d) return '';
  const now   = new Date();
  const diffMs = d - now;
  const diffH  = diffMs / 3_600_000;
  const diffD  = Math.round(diffMs / 86_400_000);

  if (Math.abs(diffH) < 1)  return 'ahora';
  if (diffH > 0 && diffH < 24) return `en ${Math.round(diffH)} h`;
  if (diffH < 0 && diffH > -24) return `hace ${Math.round(-diffH)} h`;
  if (diffD === 0)  return 'hoy';
  if (diffD === 1)  return 'mañana';
  if (diffD === -1) return 'ayer';
  return formatEventDate(rawDate);
}

// "₡8.000" | "Gratis" | "Desde ₡12.000"
export function formatPrice(price, isFree, prefix) {
  if (isFree || price === 0) return 'Gratis';
  const formatted = `₡${Number(price).toLocaleString('es-CR')}`;
  return prefix ? `Desde ${formatted}` : formatted;
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
export function formatDaysUntil(dateISO) {
  if (!dateISO) return null;
  const d = new Date(dateISO);
  if (isNaN(d)) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d - today) / 86400000);
  if (diff < 0)  return null;
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  return `faltan ${diff} días`;
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
  const DAYS_FULL = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const day  = d.getDate();
  const month = MONTHS_FULL[d.getMonth()];
  const year  = d.getFullYear();
  return `${DAYS_FULL[d.getDay()].charAt(0).toUpperCase() + DAYS_FULL[d.getDay()].slice(1)} ${day} de ${month} del ${year}`;
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
  const dayName  = DAYS_FULL_ES[d.getDay()].toUpperCase();
  const day      = d.getDate();
  const month    = MONTHS_FULL[d.getMonth()].toUpperCase();

  if (d.toDateString() === today.toDateString()) {
    return { label: `HOY · ${dayName} ${day}`, isToday: true };
  }
  if (d.toDateString() === tomorrow.toDateString()) {
    return { label: `MAÑANA · ${dayName} ${day}`, isToday: false };
  }
  return { label: `${dayName} ${day} DE ${month}`, isToday: false };
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

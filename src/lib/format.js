// Utilidades de formato — fuente única de verdad para fechas y precios.
// Ninguna pantalla debe formatear fechas por su cuenta (§ 3 del design system).

const DAYS_ES   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_FULL = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

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

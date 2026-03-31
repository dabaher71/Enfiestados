import * as Linking from 'expo-linking';

// ── URL ─────────────────────────────────────────────────────────────────────
// safeOpenURL acepta http y https para abrir links externos
const OPEN_PROTOCOLS = ['https:', 'http:'];

/**
 * Abre una URL solo si tiene esquema http/https.
 * Evita intent://, javascript:, data: y otros esquemas peligrosos.
 */
export const safeOpenURL = async (url) => {
  if (!url || typeof url !== 'string') return;
  try {
    const parsed = new URL(url.trim());
    if (!OPEN_PROTOCOLS.includes(parsed.protocol)) return;
    const supported = await Linking.canOpenURL(url);
    if (supported) Linking.openURL(url);
  } catch {
    // URL malformada — no abrir
  }
};

/**
 * Valida que una URL sea estrictamente https (no http).
 * Usado para links que el usuario ingresa en la app.
 */
export const isValidWebURL = (url) => {
  if (!url || typeof url !== 'string') return false;
  try {
    const { protocol } = new URL(url.trim());
    return protocol === 'https:';
  } catch {
    return false;
  }
};

// ── Imágenes ─────────────────────────────────────────────────────────────────
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Verifica que el asset del ImagePicker no supere el límite de tamaño.
 * Retorna true si es válido, false si es demasiado grande.
 */
export const validateImageSize = (asset, maxBytes = MAX_IMAGE_BYTES) => {
  if (!asset) return false;
  if (asset.fileSize && asset.fileSize > maxBytes) return false;
  return true;
};

/**
 * Verifica que el tipo MIME del blob sea una imagen permitida.
 */
export const validateImageMime = (blob) => {
  if (!blob || !blob.type) return false;
  return ALLOWED_MIME_TYPES.includes(blob.type);
};

// ── Límites de texto ─────────────────────────────────────────────────────────
export const INPUT_LIMITS = {
  EVENT_TITLE: 100,
  EVENT_DESCRIPTION: 2000,
  LOCATION_NAME: 100,
  POST_TEXT: 1000,
  PRICE_MAX: 1_000_000,
  PRICE_MIN: 0,
};

/**
 * Valida y parsea un precio numérico.
 * Retorna el número si es válido, o null si no lo es.
 */
export const validatePrice = (raw) => {
  const n = parseFloat(raw);
  if (isNaN(n) || n < INPUT_LIMITS.PRICE_MIN || n > INPUT_LIMITS.PRICE_MAX) return null;
  // Redondear a 2 decimales para evitar valores como 9.999999
  return Math.round(n * 100) / 100;
};

// ── Logging seguro ───────────────────────────────────────────────────────────
/**
 * Extrae solo el mensaje de un error sin exponer objetos Firebase completos.
 * Usar en lugar de console.error(error) directamente.
 */
export const sanitizeError = (error) => {
  if (!error) return 'Error desconocido';
  if (typeof error === 'string') return error;
  return error.message || error.code || 'Error desconocido';
};

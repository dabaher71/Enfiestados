import * as Linking from 'expo-linking';

// ── URL ─────────────────────────────────────────────────────────────────────
const ALLOWED_PROTOCOLS = ['https:', 'http:'];

/**
 * Abre una URL solo si tiene esquema http/https.
 * Evita intent://, javascript:, data: y otros esquemas peligrosos.
 */
export const safeOpenURL = async (url) => {
  if (!url || typeof url !== 'string') return;
  try {
    const parsed = new URL(url.trim());
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) return;
    const supported = await Linking.canOpenURL(url);
    if (supported) Linking.openURL(url);
  } catch {
    // URL malformada — no abrir
  }
};

/**
 * Valida que una URL sea http o https.
 */
export const isValidWebURL = (url) => {
  if (!url || typeof url !== 'string') return false;
  try {
    const { protocol } = new URL(url.trim());
    return ALLOWED_PROTOCOLS.includes(protocol);
  } catch {
    return false;
  }
};

// ── Imágenes ─────────────────────────────────────────────────────────────────
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Verifica que el asset del ImagePicker no supere el límite de tamaño.
 * Retorna true si es válido, false si es demasiado grande.
 */
export const validateImageSize = (asset, maxBytes = MAX_IMAGE_BYTES) => {
  if (!asset) return false;
  if (asset.fileSize && asset.fileSize > maxBytes) return false;
  return true;
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
  return n;
};

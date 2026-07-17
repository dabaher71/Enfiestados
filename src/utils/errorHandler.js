import { sanitizeError } from './security';

// Mensajes amigables para códigos de error de Firebase
const FIREBASE_ERROR_MESSAGES = {
  'auth/network-request-failed': 'Sin conexión. Revisa tu internet.',
  'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde.',
  'auth/user-not-found': 'Usuario no encontrado.',
  'auth/wrong-password': 'Contraseña incorrecta.',
  'auth/email-already-in-use': 'Este correo ya está registrado.',
  'unavailable': 'Sin conexión con el servidor. Intenta más tarde.',
  'permission-denied': 'No tienes permiso para realizar esta acción.',
  'not-found': 'El contenido no existe o fue eliminado.',
  'resource-exhausted': 'Demasiadas solicitudes. Intenta en unos minutos.',
  'deadline-exceeded': 'La operación tardó demasiado. Intenta de nuevo.',
};

// Convierte cualquier error en un mensaje legible para el usuario
export const getFriendlyError = (error) => {
  if (!error) return 'Ocurrió un error inesperado.';
  const code = error.code || '';
  if (FIREBASE_ERROR_MESSAGES[code]) return FIREBASE_ERROR_MESSAGES[code];
  const msg = sanitizeError(error);
  // Si el mensaje interno es legible (no un objeto Firebase), mostrarlo
  if (msg && msg !== 'Error desconocido' && msg.length < 120) return msg;
  return 'Ocurrió un error inesperado. Intenta de nuevo.';
};

// Wrapper para operaciones async — loguea el error sanitizado y relanza
export const handleAsync = async (fn, fallbackMessage) => {
  try {
    return await fn();
  } catch (error) {
    const safe = sanitizeError(error);
    if (__DEV__) console.warn('[handleAsync]', safe);
    const friendly = getFriendlyError(error);
    throw new Error(fallbackMessage || friendly);
  }
};

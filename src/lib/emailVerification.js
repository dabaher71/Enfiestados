// Verificación de correo — firestore.rules exige email_verified == true para
// crear eventos, publicaciones, reportes y solicitudes de anunciante
// (isVerified). Ese dato viaja en el ID token, que Firebase renueva solo cada
// hora: después de confirmar el correo hay que refrescarlo a mano o las reglas
// siguen rechazando hasta una hora más.
import { auth } from '../config/firebase';

// true si la cuenta tiene correo y contraseña sin confirmar. Las de Google ya
// vienen verificadas y los invitados no llegan a publicar.
export async function needsEmailVerification() {
  const u = auth.currentUser;
  if (!u || u.isAnonymous || !u.email) return false;
  if (!u.emailVerified) {
    // Pudo haber confirmado con el enlace del correo desde otro lado.
    try { await u.reload(); } catch {}
    if (!auth.currentUser?.emailVerified) return true;
  }
  await refreshVerifiedToken();
  return false;
}

// Si la cuenta ya está verificada pero el token todavía dice que no, lo pide
// de nuevo para que las reglas lo vean.
export async function refreshVerifiedToken() {
  const u = auth.currentUser;
  if (!u?.emailVerified) return;
  try {
    const { claims } = await u.getIdTokenResult();
    if (claims.email_verified !== true) await u.getIdToken(true);
  } catch {}
}

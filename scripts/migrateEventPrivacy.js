/**
 * Script de migración ONE-TIME (privacidad de eventos).
 *
 * Los eventos de perfiles privados ahora solo los ven el organizador y sus
 * seguidores. firestore.rules lo hace cumplir con dos campos en cada evento:
 *   - organizerPrivate: bool
 *   - viewers: [uid]  (organizador + seguidores; vacío si es público)
 * Los eventos existentes no los tienen: este script los completa según el
 * perfil actual de cada organizador. De ahí en adelante los mantienen las
 * Cloud Functions syncEventPrivacy* (functions/index.js).
 *
 * IMPORTANTE: correrlo ANTES de desplegar las reglas nuevas. El feed filtra
 * organizerPrivate == false, y un evento sin el campo no aparecería en él.
 *
 * Por defecto corre en seco (solo informa). Para escribir:
 *   node scripts/migrateEventPrivacy.js --apply
 *
 * Requiere serviceAccountKey.json en la raíz del proyecto (NO committear).
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'enfiestados-alpha',
});

const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

// Misma lógica que eventPrivacyFor en functions/index.js.
function eventPrivacyFor(organizerId, userData) {
  const isPrivate = userData?.perfilPublico === false;
  return {
    organizerPrivate: isPrivate,
    viewers: isPrivate ? [organizerId, ...new Set(userData?.followers || [])] : [],
  };
}

async function main() {
  const events = await db.collection('events').get();
  const organizerIds = [...new Set(events.docs.map(d => d.data().organizerId).filter(Boolean))];
  const users = new Map();
  await Promise.all(organizerIds.map(async uid => {
    const snap = await db.collection('users').doc(uid).get();
    users.set(uid, snap.exists ? snap.data() : null);
  }));

  let priv = 0, pub = 0, skipped = 0;
  const writer = APPLY ? db.bulkWriter() : null;
  for (const d of events.docs) {
    const { organizerId } = d.data();
    // Sin organizador: queda público, para que no desaparezca del feed.
    if (!organizerId) skipped++;
    const target = organizerId
      ? eventPrivacyFor(organizerId, users.get(organizerId))
      : { organizerPrivate: false, viewers: [] };
    target.organizerPrivate ? priv++ : pub++;
    if (APPLY) writer.update(d.ref, target);
  }
  if (APPLY) await writer.close();

  console.log(`${events.size} eventos: ${pub} públicos, ${priv} privados, ${skipped} sin organizador (quedan públicos).`);
  console.log(APPLY ? 'Listo, escritos.' : 'En seco: no se escribió nada. Usá --apply para escribir.');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

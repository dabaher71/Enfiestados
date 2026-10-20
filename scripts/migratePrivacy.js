/**
 * Script de migración ONE-TIME (privacidad de users/{uid}).
 *
 * users/{uid} es legible por cualquier usuario autenticado, así que dos
 * campos quedaban expuestos para todos:
 *   - `email`               → se borra (el correo ya vive en Firebase Auth)
 *   - `usuariosBloqueados`  → se convierte en docs blocks/{blockerId}_{blockedId}
 *                             y después se borra el array
 *
 * Por defecto corre en seco (solo informa). Para escribir:
 *   node scripts/migratePrivacy.js --apply
 *
 * Orden recomendado: correr --apply y desplegar firestore.rules enseguida
 * (las reglas nuevas buscan los bloqueos en /blocks).
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
const { FieldValue } = admin.firestore;

async function main() {
  console.log(APPLY ? 'Modo: APLICAR cambios' : 'Modo: en seco (usar --apply para escribir)');

  const snap = await db.collection('users').get();
  const writer = db.bulkWriter();

  let withEmail = 0;
  let withBlocks = 0;
  let blockDocs = 0;

  for (const userDoc of snap.docs) {
    const data = userDoc.data();
    const blocked = Array.isArray(data.usuariosBloqueados) ? data.usuariosBloqueados : [];
    const hasEmail = 'email' in data;
    const hasBlocksField = 'usuariosBloqueados' in data;

    if (!hasEmail && !hasBlocksField) continue;
    if (hasEmail) withEmail++;
    if (blocked.length) withBlocks++;

    for (const blockedId of blocked) {
      if (typeof blockedId !== 'string' || !blockedId || blockedId === userDoc.id) continue;
      blockDocs++;
      if (APPLY) {
        writer.set(db.collection('blocks').doc(`${userDoc.id}_${blockedId}`), {
          blockerId: userDoc.id,
          blockedId,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    }

    if (APPLY) {
      writer.update(userDoc.ref, {
        email: FieldValue.delete(),
        usuariosBloqueados: FieldValue.delete(),
      });
    }
  }

  await writer.close();

  console.log(`Usuarios revisados:          ${snap.size}`);
  console.log(`Con email en el perfil:      ${withEmail}`);
  console.log(`Con bloqueos:                ${withBlocks}`);
  console.log(`Docs de /blocks a crear:     ${blockDocs}`);
  console.log(APPLY ? 'Listo.' : 'Nada se escribió (en seco).');
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});

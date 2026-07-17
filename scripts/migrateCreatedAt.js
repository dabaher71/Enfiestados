/**
 * Script de migración ONE-TIME: convierte createdAt de string ISO a Timestamp de Firestore
 * en las colecciones events, posts y notifications.
 *
 * Ejecutar una sola vez:
 *   node scripts/migrateCreatedAt.js
 *
 * Requiere: firebase-admin con credenciales de servicio.
 * Descarga el JSON de credenciales en Firebase Console →
 *   Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada
 * Guarda el archivo como scripts/serviceAccount.json (NO committear)
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'enfiestados-alpha',
});

const db = admin.firestore();
const BATCH_SIZE = 400; // Firestore permite máx 500 ops por batch

const COLLECTIONS = ['events', 'posts', 'notifications'];

async function migrateCollection(collectionName) {
  console.log(`\nMigrando colección: ${collectionName}`);
  const snap = await db.collection(collectionName).get();

  let migrated = 0;
  let skipped = 0;
  const docs = snap.docs;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + BATCH_SIZE);

    chunk.forEach((docSnap) => {
      const data = docSnap.data();
      const createdAt = data.createdAt;

      // Solo migrar si es string ISO (los Timestamps ya tienen .toDate())
      if (typeof createdAt !== 'string') {
        skipped++;
        return;
      }

      const date = new Date(createdAt);
      if (isNaN(date.getTime())) {
        console.warn(`  ⚠ Doc ${docSnap.id}: createdAt inválido ("${createdAt}"), saltando`);
        skipped++;
        return;
      }

      batch.update(docSnap.ref, {
        createdAt: admin.firestore.Timestamp.fromDate(date),
      });
      migrated++;
    });

    await batch.commit();
    console.log(`  Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} docs procesados`);
  }

  console.log(`  ✅ Migrados: ${migrated} | Saltados (ya Timestamp): ${skipped}`);
}

async function main() {
  console.log('=== Migración createdAt → Timestamp ===');
  console.log('Proyecto: enfiestados-alpha\n');

  for (const col of COLLECTIONS) {
    await migrateCollection(col);
  }

  console.log('\n✅ Migración completa. Verifica en Firebase Console antes de deployar cambios en eventService.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error en migración:', err);
  process.exit(1);
});

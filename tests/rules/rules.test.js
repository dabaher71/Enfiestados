// Pruebas de firestore.rules contra el emulador.
//
// Cada bloque corresponde a un hallazgo de la auditoría de seguridad: primero
// se comprueba que el ataque está cerrado, y después que el uso legítimo que
// la regla debe permitir sigue funcionando. Lo segundo importa tanto como lo
// primero — una regla que niega todo también "pasa" la mitad de seguridad.
//
// Correr con:  cd tests/rules && npm test

import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';

let env;

// Principales de prueba. `invitado` es el caso que más importa: la app entra
// con signInAnonymously, así que "usuario autenticado" en las reglas significa
// cualquiera que descargue la app, sin cuenta.
const ANA   = 'uid_ana';
const BETO  = 'uid_beto';
const ADMIN = 'uid_admin';
const GUEST = 'uid_invitado';

const ctx  = (uid) => env.authenticatedContext(uid).firestore();
const open = (fn) => env.withSecurityRulesDisabled((c) => fn(c.firestore()));

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'enfiestados-test',
    firestore: {
      rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

after(async () => { await env?.cleanup(); });

// Estado base: dos usuarios con perfil, un admin, una publicación de Ana con
// comentarios, un chat directo y un grupo.
async function seed() {
  await env.clearFirestore();
  await open(async (db) => {
    await setDoc(doc(db, 'users', ANA),   { uid: ANA,  name: 'Ana',  followers: [], following: [], followRequests: [], verificado: false });
    await setDoc(doc(db, 'users', BETO),  { uid: BETO, name: 'Beto', followers: [], following: [], followRequests: [], verificado: false });
    await setDoc(doc(db, 'users', ADMIN), { uid: ADMIN, name: 'Admin', isAdmin: true, followers: [] });

    // Dos comentarios: con uno solo, "vaciar" y "borrar uno" dan el mismo
    // tamaño final y la prueba de borrado masivo no probaría nada.
    await setDoc(doc(db, 'posts', 'post1'), {
      userId: ANA, createdAt: 'x',
      likes: [],
      comments: [
        { id: 'c1', userId: ANA,  text: 'uno' },
        { id: 'c2', userId: BETO, text: 'dos' },
      ],
    });

    await setDoc(doc(db, 'chats', 'grupo1'), {
      type: 'group', name: 'Amigos', ownerId: ANA, writePolicy: 'all',
      participants: [ANA, BETO], createdAt: 'x', unreadFor: [],
    });

    await setDoc(doc(db, 'messages', 'm1'), {
      chatId: 'grupo1', senderId: ANA, text: 'hola', timestamp: 'x', read: false,
    });

    await setDoc(doc(db, 'ads', 'ad1'), {
      advertiserId: BETO, status: 'active', impressions: 10, clicks: 2,
    });

    await setDoc(doc(db, 'reports', 'r1'), {
      reporterId: BETO, targetType: 'post', targetId: 'post1',
      reason: 'spam', status: 'pending', createdAt: 'x',
    });
  });
}

describe('posts — likes y comentarios ajenos', () => {
  beforeEach(seed);

  it('un invitado NO puede vaciar de un saque los comentarios ajenos', async () => {
    await assertFails(
      updateDoc(doc(ctx(GUEST), 'posts', 'post1'), { comments: [] })
    );
  });

  // Esta prueba nació fallando: el tope de ±1 solo contaba, así que se podía
  // reescribir el hilo entero con tal de que el conteo subiera en uno. Ahora
  // al agregar se exige que los viejos queden intactos como prefijo.
  it('un invitado NO puede reescribir el hilo al agregar un comentario', async () => {
    await assertFails(
      updateDoc(doc(ctx(GUEST), 'posts', 'post1'), {
        comments: [
          { id: 'c1', userId: ANA,  text: 'texto que Ana nunca escribió' },
          { id: 'c2', userId: BETO, text: 'dos' },
          { id: 'c3', userId: GUEST, text: 'tres' },
        ],
      })
    );
  });

  // LIMITACIÓN CONOCIDA, no un arreglo pendiente de prueba: las reglas no
  // pueden mirar QUÉ elemento de un array cambió, solo cuántos hay. Por eso
  // "borrar un comentario" y "borrar el comentario de otro" son
  // indistinguibles, y el tope de ±1 solo frena el borrado masivo. Cerrarlo
  // de verdad exige mover los comentarios a subcolección, donde cada
  // documento tiene su propio dueño. Esta prueba fija el comportamiento real
  // para que quede documentado y para que se note si cambia.
  it('pero SÍ puede borrar un comentario ajeno de a uno (limitación conocida)', async () => {
    await assertSucceeds(
      updateDoc(doc(ctx(GUEST), 'posts', 'post1'), {
        comments: [{ id: 'c2', userId: BETO, text: 'dos' }],
      })
    );
  });

  it('un invitado NO puede inflar los likes con uids ajenos', async () => {
    await assertFails(
      updateDoc(doc(ctx(GUEST), 'posts', 'post1'), { likes: [ANA, BETO, GUEST] })
    );
  });

  it('pero Beto SÍ puede dar su propio like', async () => {
    await assertSucceeds(
      updateDoc(doc(ctx(BETO), 'posts', 'post1'), { likes: [BETO] })
    );
  });

  it('y SÍ puede agregar un comentario', async () => {
    await assertSucceeds(
      updateDoc(doc(ctx(BETO), 'posts', 'post1'), {
        comments: [
          { id: 'c1', userId: ANA,  text: 'uno' },
          { id: 'c2', userId: BETO, text: 'dos' },
          { id: 'c3', userId: BETO, text: 'qué tal' },
        ],
      })
    );
  });
});

describe('users — campos de autoridad', () => {
  beforeEach(seed);

  it('Ana NO puede auto-asignarse la insignia de verificado', async () => {
    await assertFails(
      updateDoc(doc(ctx(ANA), 'users', ANA), { verificado: true })
    );
  });

  it('Ana NO puede darse saldo de anuncios', async () => {
    await assertFails(
      updateDoc(doc(ctx(ANA), 'users', ANA), { adCredits: 999999 })
    );
  });

  it('Ana NO puede marcarse como anunciante', async () => {
    await assertFails(
      updateDoc(doc(ctx(ANA), 'users', ANA), { isAdvertiser: true })
    );
  });

  it('Ana NO puede hacerse admin', async () => {
    await assertFails(
      updateDoc(doc(ctx(ANA), 'users', ANA), { isAdmin: true })
    );
  });

  it('Ana NO puede inflarse los seguidores', async () => {
    await assertFails(
      updateDoc(doc(ctx(ANA), 'users', ANA), { followers: [BETO, GUEST, 'relleno'] })
    );
  });

  it('pero SÍ puede editar su propio perfil', async () => {
    await assertSucceeds(
      updateDoc(doc(ctx(ANA), 'users', ANA), { name: 'Ana María', bio: 'hola' })
    );
  });
});

describe('users — seguir (estaba roto en producción)', () => {
  beforeEach(seed);

  it('Beto SÍ puede seguir a Ana', async () => {
    await assertSucceeds(
      updateDoc(doc(ctx(BETO), 'users', ANA), { followers: [BETO] })
    );
  });

  it('Beto SÍ puede dejar de seguirla', async () => {
    await open((db) => setDoc(doc(db, 'users', ANA), { followers: [BETO] }, { merge: true }));
    await assertSucceeds(
      updateDoc(doc(ctx(BETO), 'users', ANA), { followers: [] })
    );
  });

  it('Beto SÍ puede pedir seguir una cuenta privada', async () => {
    await assertSucceeds(
      updateDoc(doc(ctx(BETO), 'users', ANA), { followRequests: [BETO] })
    );
  });

  it('pero NO puede meter a un tercero como seguidor de Ana', async () => {
    await assertFails(
      updateDoc(doc(ctx(BETO), 'users', ANA), { followers: [GUEST] })
    );
  });

  it('ni cambiarle el nombre de paso', async () => {
    await assertFails(
      updateDoc(doc(ctx(BETO), 'users', ANA), { followers: [BETO], name: 'hackeado' })
    );
  });
});

describe('notifications — suplantación', () => {
  beforeEach(seed);

  it('un invitado sin perfil NO puede notificar a nadie', async () => {
    await assertFails(
      setDoc(doc(ctx(GUEST), 'notifications', 'n1'), {
        fromUserId: GUEST, toUserId: ANA, type: 'follow',
        fromUserName: 'Enfiestados', message: 'verificá tu cuenta', read: false, createdAt: 'x',
      })
    );
  });

  it('NO se acepta un tipo inventado', async () => {
    await assertFails(
      setDoc(doc(ctx(BETO), 'notifications', 'n2'), {
        fromUserId: BETO, toUserId: ANA, type: 'alerta_de_seguridad',
        message: 'tu cuenta será suspendida', read: false, createdAt: 'x',
      })
    );
  });

  it('NO se acepta un mensaje largo (carga de phishing)', async () => {
    await assertFails(
      setDoc(doc(ctx(BETO), 'notifications', 'n3'), {
        fromUserId: BETO, toUserId: ANA, type: 'follow',
        message: 'x'.repeat(201), read: false, createdAt: 'x',
      })
    );
  });

  it('pero una notificación legítima SÍ pasa', async () => {
    await assertSucceeds(
      setDoc(doc(ctx(BETO), 'notifications', 'n4'), {
        fromUserId: BETO, toUserId: ANA, type: 'follow',
        fromUserName: 'Beto', message: 'empezó a seguirte', read: false, createdAt: 'x',
      })
    );
  });
});

describe('chats — salir de un grupo', () => {
  beforeEach(seed);

  it('Beto NO puede agregar gente mientras se va', async () => {
    await assertFails(
      updateDoc(doc(ctx(BETO), 'chats', 'grupo1'), { participants: [ANA, GUEST, 'otro1', 'otro2'] })
    );
  });

  it('pero SÍ puede salirse', async () => {
    await assertSucceeds(
      updateDoc(doc(ctx(BETO), 'chats', 'grupo1'), { participants: [ANA] })
    );
  });

  it('un no-miembro NO puede sacar a otro del grupo', async () => {
    await seed();
    await assertFails(
      updateDoc(doc(ctx(GUEST), 'chats', 'grupo1'), { participants: [ANA] })
    );
  });
});

describe('chats — canal de solo lectura (writePolicy)', () => {
  before(async () => {
    await seed();
    await open((db) => setDoc(doc(db, 'chats', 'grupo1'), { writePolicy: 'owner' }, { merge: true }));
  });

  it('un miembro que no es dueño NO puede escribir', async () => {
    await assertFails(
      setDoc(doc(ctx(BETO), 'messages', 'm2'), {
        chatId: 'grupo1', senderId: BETO, text: 'hola', timestamp: 'x',
      })
    );
  });

  it('pero el dueño SÍ', async () => {
    await assertSucceeds(
      setDoc(doc(ctx(ANA), 'messages', 'm3'), {
        chatId: 'grupo1', senderId: ANA, text: 'aviso', timestamp: 'x',
      })
    );
  });
});

describe('messages — marcar como leído', () => {
  beforeEach(seed);

  it('alguien ajeno al chat NO puede marcar leído un mensaje', async () => {
    await assertFails(
      updateDoc(doc(ctx(GUEST), 'messages', 'm1'), { read: true })
    );
  });

  it('pero un participante SÍ', async () => {
    await assertSucceeds(
      updateDoc(doc(ctx(BETO), 'messages', 'm1'), { read: true })
    );
  });
});

describe('messages — fotos en chats', () => {
  beforeEach(seed);

  // grupo1: ownerId ANA, participantes [ANA, BETO], writePolicy 'all'.
  const OK_URL  = 'https://firebasestorage.googleapis.com/v0/b/enfiestados-alpha.firebasestorage.app/o/chats%2Fuid_ana%2Fabc?alt=media';
  const MAL_URL = 'https://evil.example.com/pixel.jpg';
  const msg = (extra) => ({ chatId: 'grupo1', senderId: extra.senderId, text: '', timestamp: 'x', read: false, ...extra });

  it('el dueño del grupo SÍ puede mandar una foto', async () => {
    await assertSucceeds(
      setDoc(doc(ctx(ANA), 'messages', 'mf1'), msg({ senderId: ANA, imageUrl: OK_URL }))
    );
  });

  it('un miembro que NO es el dueño no puede mandar fotos, aunque pueda escribir texto', async () => {
    await assertSucceeds(
      setDoc(doc(ctx(BETO), 'messages', 'mf2'), msg({ senderId: BETO, text: 'hola' }))
    );
    await assertFails(
      setDoc(doc(ctx(BETO), 'messages', 'mf3'), msg({ senderId: BETO, imageUrl: OK_URL }))
    );
  });

  it('una foto sin texto es un mensaje válido', async () => {
    await assertSucceeds(
      setDoc(doc(ctx(ANA), 'messages', 'mf4'), msg({ senderId: ANA, text: '', imageUrl: OK_URL }))
    );
  });

  it('un mensaje sin texto y sin foto se rechaza', async () => {
    await assertFails(
      setDoc(doc(ctx(ANA), 'messages', 'mf5'), msg({ senderId: ANA, text: '' }))
    );
  });

  it('una imageUrl alojada fuera de nuestro Storage se rechaza', async () => {
    await assertFails(
      setDoc(doc(ctx(ANA), 'messages', 'mf6'), msg({ senderId: ANA, imageUrl: MAL_URL }))
    );
  });
});

describe('ads — métricas', () => {
  beforeEach(seed);

  it('NO se puede fijar un valor arbitrario de impresiones', async () => {
    await assertFails(
      updateDoc(doc(ctx(GUEST), 'ads', 'ad1'), { impressions: 999999 })
    );
  });

  it('pero SÍ sumar una', async () => {
    await assertSucceeds(
      updateDoc(doc(ctx(GUEST), 'ads', 'ad1'), { impressions: 11 })
    );
  });
});

describe('reports — panel de moderación', () => {
  beforeEach(seed);

  it('el admin SÍ puede listar los reportes pendientes', async () => {
    await assertSucceeds(
      getDocs(query(collection(ctx(ADMIN), 'reports'), where('status', '==', 'pending')))
    );
  });

  it('un usuario común NO puede listarlos', async () => {
    await assertFails(
      getDocs(query(collection(ctx(ANA), 'reports'), where('status', '==', 'pending')))
    );
  });
});

describe('accountDeletionRequests — códigos de borrado', () => {
  beforeEach(seed);

  it('nadie puede leer los códigos (fuerza bruta offline)', async () => {
    await assertFails(getDoc(doc(ctx(ANA), 'accountDeletionRequests', ANA)));
  });

  it('ni siquiera el dueño de la cuenta puede escribirlos', async () => {
    await assertFails(
      setDoc(doc(ctx(ANA), 'accountDeletionRequests', ANA), { codeHash: 'x', attempts: 0 })
    );
  });
});

describe('users — datos privados fuera del perfil público', () => {
  beforeEach(seed);

  // users/{uid} lo lee cualquier autenticado (invitados incluidos), así que
  // el correo y la lista de bloqueados no pueden vivir ahí.
  it('un perfil nuevo NO puede traer el email', async () => {
    await assertFails(
      setDoc(doc(ctx(GUEST), 'users', GUEST), { uid: GUEST, name: 'Invitado', email: 'g@x.com' })
    );
  });

  it('ni la lista de bloqueados', async () => {
    await assertFails(
      setDoc(doc(ctx(GUEST), 'users', GUEST), { uid: GUEST, name: 'Invitado', usuariosBloqueados: [] })
    );
  });

  it('Ana NO puede volver a escribir su email en el perfil', async () => {
    await assertFails(
      updateDoc(doc(ctx(ANA), 'users', ANA), { email: 'ana@x.com' })
    );
  });

  it('pero SÍ se puede crear un perfil normal', async () => {
    await assertSucceeds(
      setDoc(doc(ctx(GUEST), 'users', GUEST), { uid: GUEST, name: 'Invitado', followers: [] })
    );
  });
});

describe('blocks — bloqueos privados', () => {
  beforeEach(seed);

  const block = (uid, other) =>
    setDoc(doc(ctx(uid), 'blocks', `${uid}_${other}`), { blockerId: uid, blockedId: other, createdAt: 'x' });

  it('Ana SÍ puede bloquear a Beto', async () => {
    await assertSucceeds(block(ANA, BETO));
  });

  it('Ana NO puede crear un bloqueo a nombre de Beto', async () => {
    await assertFails(
      setDoc(doc(ctx(ANA), 'blocks', `${BETO}_${ANA}`), { blockerId: BETO, blockedId: ANA, createdAt: 'x' })
    );
  });

  it('el ID tiene que calzar con quién bloquea a quién', async () => {
    await assertFails(
      setDoc(doc(ctx(ANA), 'blocks', `${ANA}_${GUEST}`), { blockerId: ANA, blockedId: BETO, createdAt: 'x' })
    );
  });

  it('Beto SÍ ve que Ana lo bloqueó (para ocultarla en ambos sentidos)', async () => {
    await block(ANA, BETO);
    await assertSucceeds(
      getDocs(query(collection(ctx(BETO), 'blocks'), where('blockedId', '==', BETO)))
    );
  });

  it('un tercero NO puede ver a quién bloqueó Ana', async () => {
    await block(ANA, BETO);
    await assertFails(
      getDocs(query(collection(ctx(GUEST), 'blocks'), where('blockerId', '==', ANA)))
    );
  });

  it('Beto NO puede borrar el bloqueo que le puso Ana', async () => {
    await block(ANA, BETO);
    await assertFails(
      deleteDoc(doc(ctx(BETO), 'blocks', `${ANA}_${BETO}`))
    );
  });

  it('con un bloqueo de por medio NO se puede abrir un chat directo', async () => {
    await block(ANA, BETO);
    await assertFails(
      setDoc(doc(ctx(BETO), 'chats', 'directo1'), { participants: [BETO, ANA], createdAt: 'x' })
    );
  });

  it('sin bloqueo SÍ', async () => {
    await assertSucceeds(
      setDoc(doc(ctx(BETO), 'chats', 'directo1'), { participants: [BETO, ANA], createdAt: 'x' })
    );
  });
});

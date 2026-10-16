// Pruebas de firestore.rules contra el emulador.
//
// Cada bloque corresponde a un hallazgo de la auditoría de seguridad: primero
// se comprueba que el ataque está cerrado, y después que el uso legítimo que
// la regla debe permitir sigue funcionando. Lo segundo importa tanto como lo
// primero — una regla que niega todo también "pasa" la mitad de seguridad.
//
// Correr con:  cd tests/rules && npm test

import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';

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
    await setDoc(doc(db, 'users', ANA),   { uid: ANA,  name: 'Ana',  email: 'ana@x.com',  followers: [], following: [], followRequests: [], verificado: false, usuariosBloqueados: [] });
    await setDoc(doc(db, 'users', BETO),  { uid: BETO, name: 'Beto', email: 'beto@x.com', followers: [], following: [], followRequests: [], verificado: false, usuariosBloqueados: [] });
    await setDoc(doc(db, 'users', ADMIN), { uid: ADMIN, name: 'Admin', isAdmin: true, followers: [], usuariosBloqueados: [] });

    await setDoc(doc(db, 'posts', 'post1'), {
      userId: ANA, createdAt: 'x',
      likes: [], comments: [{ id: 'c1', userId: ANA, text: 'hola' }],
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
  before(seed);

  it('un invitado NO puede vaciar los comentarios de una publicación ajena', async () => {
    await assertFails(
      updateDoc(doc(ctx(GUEST), 'posts', 'post1'), { comments: [] })
    );
  });

  it('un invitado NO puede reemplazar los comentarios por contenido falso', async () => {
    await assertFails(
      updateDoc(doc(ctx(GUEST), 'posts', 'post1'), {
        comments: [{ id: 'x', userId: ANA, text: 'texto que Ana nunca escribió' }],
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
        comments: [{ id: 'c1', userId: ANA, text: 'hola' }, { id: 'c2', userId: BETO, text: 'qué tal' }],
      })
    );
  });
});

describe('users — campos de autoridad', () => {
  before(seed);

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
  before(seed);

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
  before(seed);

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
  before(seed);

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
  before(seed);

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

describe('ads — métricas', () => {
  before(seed);

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
  before(seed);

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
  before(seed);

  it('nadie puede leer los códigos (fuerza bruta offline)', async () => {
    await assertFails(getDoc(doc(ctx(ANA), 'accountDeletionRequests', ANA)));
  });

  it('ni siquiera el dueño de la cuenta puede escribirlos', async () => {
    await assertFails(
      setDoc(doc(ctx(ANA), 'accountDeletionRequests', ANA), { codeHash: 'x', attempts: 0 })
    );
  });
});

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Bloqueos: un documento por par en blocks/{blockerId}_{blockedId}.
// Antes vivían en users/{uid}.usuariosBloqueados, y como cualquier usuario
// puede leer cualquier perfil, la lista de a quién bloqueó cada persona era
// pública. Acá cada bloqueo solo lo pueden leer las dos partes, y el ID
// determinista deja que firestore.rules lo verifique con un exists().
export const blockDocId = (blockerId, blockedId) => `${blockerId}_${blockedId}`;

export const blockUser = (blockerId, blockedId) =>
  setDoc(doc(db, 'blocks', blockDocId(blockerId, blockedId)), {
    blockerId,
    blockedId,
    createdAt: serverTimestamp(),
  });

export const unblockUser = (blockerId, blockedId) =>
  deleteDoc(doc(db, 'blocks', blockDocId(blockerId, blockedId)));

// A quién bloqueé yo → callback(ids bloqueados)
export const subscribeToMyBlocks = (uid, callback) =>
  onSnapshot(
    query(collection(db, 'blocks'), where('blockerId', '==', uid)),
    snap => callback(snap.docs.map(d => d.data().blockedId)),
    () => callback([])
  );

// Quién me bloqueó a mí → callback(ids de quienes me bloquearon)
export const subscribeToBlockedMe = (uid, callback) =>
  onSnapshot(
    query(collection(db, 'blocks'), where('blockedId', '==', uid)),
    snap => callback(snap.docs.map(d => d.data().blockerId)),
    () => callback([])
  );

import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db } from '../config/firebase';

// Combina ambas direcciones de bloqueo: a quién bloqueé yo (mi propio doc)
// y quién me bloqueó a mí (query array-contains sobre toda la colección).
// allBlocked es lo que hay que usar para filtrar feed/comentarios/chat —
// el bloqueo tiene que ser invisible en ambos sentidos, no solo el mío.
export default function useBlockedUsers() {
  const uid = auth.currentUser?.uid;
  const [blockedByMe, setBlockedByMe] = useState(new Set());
  const [blockedMe, setBlockedMe] = useState(new Set());

  useEffect(() => {
    if (!uid) {
      setBlockedByMe(new Set());
      setBlockedMe(new Set());
      return;
    }

    const unsubMine = onSnapshot(doc(db, 'users', uid), snap => {
      setBlockedByMe(new Set(snap.data()?.usuariosBloqueados || []));
    });

    const unsubOthers = onSnapshot(
      query(collection(db, 'users'), where('usuariosBloqueados', 'array-contains', uid)),
      snap => setBlockedMe(new Set(snap.docs.map(d => d.id)))
    );

    return () => { unsubMine(); unsubOthers(); };
  }, [uid]);

  const allBlocked = new Set([...blockedByMe, ...blockedMe]);
  return { blockedByMe, blockedMe, allBlocked };
}

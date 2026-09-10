import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { auth, db } from '../config/firebase';

// Combina ambas direcciones de bloqueo: a quién bloqueé yo (mi propio doc)
// y quién me bloqueó a mí (query array-contains sobre toda la colección).
// allBlocked es lo que hay que usar para filtrar feed/comentarios/chat —
// el bloqueo tiene que ser invisible en ambos sentidos, no solo el mío.
//
// IMPORTANTE: los tres valores que devuelve tienen que ser referencialmente
// estables entre renders. Las pantallas los usan como dependencia de useMemo
// (ej. filteredNative en SearchScreen), y ese useMemo alimenta un useEffect
// que hace setState — si acá se devuelve un Set nuevo en cada render, eso es
// un bucle infinito ("Maximum update depth exceeded"). De ahí el useMemo de
// abajo y el guardar arrays ordenados en el estado en vez de Sets sueltos.
const EMPTY = [];

// Evita re-render si el contenido no cambió: onSnapshot re-dispara ante
// cualquier escritura del doc (incluidas las que no tocan usuariosBloqueados).
function sameIds(a, b) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

export default function useBlockedUsers() {
  const uid = auth.currentUser?.uid;
  const [blockedByMeIds, setBlockedByMeIds] = useState(EMPTY);
  const [blockedMeIds, setBlockedMeIds] = useState(EMPTY);

  useEffect(() => {
    if (!uid) {
      setBlockedByMeIds(EMPTY);
      setBlockedMeIds(EMPTY);
      return;
    }

    const update = (setter) => (next) => {
      const sorted = [...next].sort();
      setter(prev => (sameIds(prev, sorted) ? prev : sorted));
    };

    const unsubMine = onSnapshot(doc(db, 'users', uid), snap => {
      update(setBlockedByMeIds)(snap.data()?.usuariosBloqueados || []);
    });

    const unsubOthers = onSnapshot(
      query(collection(db, 'users'), where('usuariosBloqueados', 'array-contains', uid)),
      snap => update(setBlockedMeIds)(snap.docs.map(d => d.id))
    );

    return () => { unsubMine(); unsubOthers(); };
  }, [uid]);

  const blockedByMe = useMemo(() => new Set(blockedByMeIds), [blockedByMeIds]);
  const blockedMe   = useMemo(() => new Set(blockedMeIds),   [blockedMeIds]);
  const allBlocked  = useMemo(
    () => new Set([...blockedByMeIds, ...blockedMeIds]),
    [blockedByMeIds, blockedMeIds]
  );

  return { blockedByMe, blockedMe, allBlocked };
}

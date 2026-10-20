import { useEffect, useMemo, useState } from 'react';
import { auth } from '../config/firebase';
import { subscribeToBlockedMe, subscribeToMyBlocks } from '../services/blockService';

// Combina ambas direcciones de bloqueo: a quién bloqueé yo y quién me
// bloqueó a mí, las dos sobre la colección blocks (ver blockService.js).
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

// Evita re-render si el contenido no cambió: onSnapshot puede re-disparar
// con el mismo conjunto de ids (p. ej. al reconectar).
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

    const unsubMine   = subscribeToMyBlocks(uid, update(setBlockedByMeIds));
    const unsubOthers = subscribeToBlockedMe(uid, update(setBlockedMeIds));

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

import { useEffect, useState } from 'react';

import { auth } from '../config/firebase';
import { subscribeToVisiblePrivateEvents } from '../services/eventService';

// Eventos de perfiles privados que el usuario actual puede ver (los de
// quienes sigue y los propios). El feed general solo trae públicos (ver
// eventService), así que las pantallas que listan eventos suman estos.
export default function useVisiblePrivateEvents() {
  const uid = auth.currentUser?.uid;
  const [events, setEvents] = useState([]);
  useEffect(() => subscribeToVisiblePrivateEvents(uid, setEvents), [uid]);
  return events;
}

// Une dos listas de eventos sin repetir ids (la primera manda).
export function mergeEvents(a, b) {
  const ids = new Set(a.map(e => e.id));
  return [...a, ...b.filter(e => !ids.has(e.id))];
}

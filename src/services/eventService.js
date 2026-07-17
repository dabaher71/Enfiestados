import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export const eventsCollection = collection(db, 'events');

const PAGE_SIZE = 20;

// Suscripción en tiempo real para la primera página
export const subscribeToEvents = (onUpdate) => {
  const q = query(eventsCollection, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
  return onSnapshot(q, (snapshot) => {
    const events = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const lastDoc = snapshot.docs[snapshot.docs.length - 1] ?? null;
    onUpdate(events, lastDoc);
  });
};

// Carga de páginas adicionales (sin tiempo real)
export const fetchMoreEvents = async (lastDoc) => {
  const q = query(eventsCollection, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE));
  const snapshot = await getDocs(q);
  const events = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  const newLastDoc = snapshot.docs[snapshot.docs.length - 1] ?? null;
  return { events, lastDoc: newLastDoc, hasMore: snapshot.docs.length === PAGE_SIZE };
};

export const createEvent = async (eventData) => {
  const docRef = await addDoc(eventsCollection, {
    ...eventData,
    likes: [],
    attendees: [],
    comments: [],
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

// Transacción atómica — elimina race condition en likes concurrentes
export const toggleLike = async (eventId, userId) => {
  const eventRef = doc(db, 'events', eventId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(eventRef);
    if (!snap.exists()) throw new Error('Evento no encontrado');
    const likes = snap.data().likes || [];
    const newLikes = likes.includes(userId)
      ? likes.filter(id => id !== userId)
      : [...likes, userId];
    tx.update(eventRef, { likes: newLikes });
    return newLikes;
  });
};

// Transacción atómica — elimina race condition en asistencia concurrente
export const toggleAttendance = async (eventId, userId) => {
  const eventRef = doc(db, 'events', eventId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(eventRef);
    if (!snap.exists()) throw new Error('Evento no encontrado');
    const attendees = snap.data().attendees || [];
    const newAttendees = attendees.includes(userId)
      ? attendees.filter(id => id !== userId)
      : [...attendees, userId];
    tx.update(eventRef, { attendees: newAttendees });
    return newAttendees;
  });
};

export const deleteEvent = async (eventId, userId) => {
  const eventRef = doc(db, 'events', eventId);
  const eventSnap = await getDoc(eventRef);
  if (!eventSnap.exists() || eventSnap.data().organizerId !== userId) {
    throw new Error('No tienes permiso para eliminar este evento');
  }
  await deleteDoc(eventRef);
};

// ID generado por Firestore (no Date.now) — elimina colisiones
export const addComment = async (eventId, comment) => {
  const eventRef = doc(db, 'events', eventId);
  const commentId = doc(collection(db, '_')).id;
  const newComment = {
    id: commentId,
    ...comment,
    text: comment.text.slice(0, 500),
    createdAt: new Date().toISOString(),
  };
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(eventRef);
    if (!snap.exists()) throw new Error('Evento no encontrado');
    const comments = snap.data().comments || [];
    tx.update(eventRef, { comments: [...comments, newComment] });
    return newComment;
  });
};

export const updateEvent = async (eventId, eventData) => {
  const eventRef = doc(db, 'events', eventId);
  await updateDoc(eventRef, { ...eventData, updatedAt: new Date().toISOString() });
};

// Obtiene eventos por lista de IDs (lotes de 10 por límite de Firestore 'in')
export const fetchEventsByIds = async (ids) => {
  if (!ids?.length) return [];
  const batches = [];
  for (let i = 0; i < ids.length; i += 10) {
    batches.push(ids.slice(i, i + 10));
  }
  const results = await Promise.all(
    batches.map(batch =>
      getDocs(query(eventsCollection, where('__name__', 'in', batch)))
    )
  );
  return results.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
};

export const deleteComment = async (eventId, commentId, userId) => {
  const eventRef = doc(db, 'events', eventId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(eventRef);
    if (!snap.exists()) throw new Error('Evento no encontrado');
    const comments = snap.data().comments || [];
    const comment = comments.find(c => c.id === commentId);
    if (!comment) throw new Error('Comentario no encontrado');
    const commentOwnerId = comment.userId || comment.uid || comment.authorId;
    if (commentOwnerId !== userId && snap.data().organizerId !== userId) {
      throw new Error('No tienes permiso para eliminar este comentario');
    }
    const updated = comments.filter(c => c.id !== commentId);
    tx.update(eventRef, { comments: updated });
    return updated;
  });
};

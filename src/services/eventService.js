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

// ── Eventos de perfiles privados ──────────────────────────────────────────
// Un evento cuyo organizador tiene el perfil privado solo lo ven el
// organizador y sus seguidores aprobados. Cada evento lleva:
//   organizerPrivate: bool      — el organizador es privado
//   viewers: [uid]              — organizador + seguidores (vacío si es público)
// Los mantiene al día una Cloud Function (syncEventPrivacy*) cuando el
// organizador cambia de privacidad o gana/pierde seguidores; acá se ponen al
// crear para que el evento nazca bien.
//
// firestore.rules solo deja LISTAR eventos con una consulta que garantice que
// todos los resultados son visibles: el feed general filtra
// organizerPrivate == false, y los privados se piden aparte con
// viewers array-contains <uid>. Una consulta sin esos filtros falla.

// Campos de privacidad para un evento nuevo de este organizador.
export const privacyFieldsFor = (organizerId, userData) => {
  const isPrivate = userData?.perfilPublico === false;
  return {
    organizerPrivate: isPrivate,
    viewers: isPrivate ? [organizerId, ...(userData?.followers || [])] : [],
  };
};

// Suscripción en tiempo real para la primera página (solo eventos públicos)
export const subscribeToEvents = (onUpdate, onError) => {
  const q = query(eventsCollection, where('organizerPrivate', '==', false), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
  return onSnapshot(q, (snapshot) => {
    const events = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const lastDoc = snapshot.docs[snapshot.docs.length - 1] ?? null;
    onUpdate(events, lastDoc);
  }, onError);
};

// Eventos privados que este usuario puede ver: los de perfiles privados que
// sigue, y los suyos si su perfil es privado.
export const subscribeToVisiblePrivateEvents = (uid, onUpdate) => {
  if (!uid) { onUpdate([]); return () => {}; }
  const q = query(eventsCollection, where('viewers', 'array-contains', uid), limit(100));
  return onSnapshot(q, (snapshot) => {
    onUpdate(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  }, () => onUpdate([]));
};

// Eventos de un organizador concreto, respetando su privacidad:
//  - los propios: todos
//  - de un perfil privado que sigo: los que me incluyen en viewers
//  - de cualquier otro: solo los públicos
export const subscribeToOrganizerEvents = (organizerId, viewerUid, { followsPrivate = false } = {}, onUpdate) => {
  const filters = organizerId === viewerUid
    ? [where('organizerId', '==', organizerId)]
    : followsPrivate
      ? [where('organizerId', '==', organizerId), where('viewers', 'array-contains', viewerUid)]
      : [where('organizerId', '==', organizerId), where('organizerPrivate', '==', false)];
  return onSnapshot(query(eventsCollection, ...filters), (snapshot) => {
    onUpdate(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  }, () => onUpdate([]));
};

// Carga de páginas adicionales (sin tiempo real, solo eventos públicos)
export const fetchMoreEvents = async (lastDoc) => {
  const q = query(eventsCollection, where('organizerPrivate', '==', false), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE));
  const snapshot = await getDocs(q);
  const events = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  const newLastDoc = snapshot.docs[snapshot.docs.length - 1] ?? null;
  return { events, lastDoc: newLastDoc, hasMore: snapshot.docs.length === PAGE_SIZE };
};

export const createEvent = async (eventData) => {
  // Privacidad según el perfil actual del organizador. Si esto falla, el
  // evento igual se crea y la Cloud Function onEventCreatedPrivacy lo corrige.
  let privacy = { organizerPrivate: false, viewers: [] };
  try {
    const userSnap = await getDoc(doc(db, 'users', eventData.organizerId));
    privacy = privacyFieldsFor(eventData.organizerId, userSnap.data());
  } catch {}
  const docRef = await addDoc(eventsCollection, {
    ...eventData,
    ...privacy,
    likes: [],
    attendees: [],
    savedBy: [],
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

// Transacción atómica — guardar/quitar de "Mis planes" (bookmark, § 4.3)
export const toggleSaved = async (eventId, userId) => {
  const eventRef = doc(db, 'events', eventId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(eventRef);
    if (!snap.exists()) throw new Error('Evento no encontrado');
    const savedBy = snap.data().savedBy || [];
    const newSavedBy = savedBy.includes(userId)
      ? savedBy.filter(id => id !== userId)
      : [...savedBy, userId];
    tx.update(eventRef, { savedBy: newSavedBy });
    return newSavedBy;
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

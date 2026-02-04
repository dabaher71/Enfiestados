import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const eventsCollection = collection(db, 'events');

export const subscribeToEvents = (onUpdate) => {
  const q = query(eventsCollection, orderBy('createdAt', 'desc'));
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const events = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    onUpdate(events);
  });

  return unsubscribe;
};

export const createEvent = async (eventData) => {
  try {
    const docRef = await addDoc(eventsCollection, {
      ...eventData,
      likes: [],
      attendees: [],
      comments: [],
      createdAt: new Date().toISOString(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error al crear evento:', error);
    throw error;
  }
};

export const toggleLike = async (eventId, userId) => {
  try {
    const eventRef = doc(db, 'events', eventId);
    const eventSnap = await getDoc(eventRef);
    const eventData = eventSnap.data();
    
    const likes = eventData.likes || [];
    const newLikes = likes.includes(userId)
      ? likes.filter(id => id !== userId)
      : [...likes, userId];
    
    await updateDoc(eventRef, { likes: newLikes });
    return newLikes;
  } catch (error) {
    console.error('Error al dar like:', error);
    throw error;
  }
};

export const toggleAttendance = async (eventId, userId) => {
  try {
    const eventRef = doc(db, 'events', eventId);
    const eventSnap = await getDoc(eventRef);
    const eventData = eventSnap.data();
    
    const attendees = eventData.attendees || [];
    const newAttendees = attendees.includes(userId)
      ? attendees.filter(id => id !== userId)
      : [...attendees, userId];
    
    await updateDoc(eventRef, { attendees: newAttendees });
    return newAttendees;
  } catch (error) {
    console.error('Error al marcar asistencia:', error);
    throw error;
  }
};

export const deleteEvent = async (eventId) => {
  try {
    await deleteDoc(doc(db, 'events', eventId));
  } catch (error) {
    console.error('Error al eliminar evento:', error);
    throw error;
  }
};

export const addComment = async (eventId, comment) => {
  try {
    const eventRef = doc(db, 'events', eventId);
    const eventSnap = await getDoc(eventRef);
    const eventData = eventSnap.data();
    
    const comments = eventData.comments || [];
    const newComment = {
      id: Date.now().toString(),
      ...comment,
      createdAt: new Date().toISOString(),
    };
    
    await updateDoc(eventRef, { 
      comments: [...comments, newComment] 
    });
    
    return newComment;
  } catch (error) {
    console.error('Error al agregar comentario:', error);
    throw error;
  }
};

export const updateEvent = async (eventId, eventData) => {
  try {
    const eventRef = doc(db, 'events', eventId);
    await updateDoc(eventRef, {
      ...eventData,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error al actualizar evento:', error);
    throw error;
  }
};
export const deleteComment = async (eventId, commentId) => {
  try {
    const eventRef = doc(db, 'events', eventId);
    const eventSnap = await getDoc(eventRef);
    const eventData = eventSnap.data();
    
    const comments = eventData.comments || [];
    const updatedComments = comments.filter(c => c.id !== commentId);
    
    await updateDoc(eventRef, { comments: updatedComments });
    return updatedComments;
  } catch (error) {
    console.error('Error al eliminar comentario:', error);
    throw error;
  }
};
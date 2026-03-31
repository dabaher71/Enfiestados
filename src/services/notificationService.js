import { addDoc, collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';

export const NOTIFICATION_TYPES = {
  LIKE: 'like',              // like en evento
  COMMENT: 'comment',        // comentario en evento
  FOLLOW: 'follow',
  FOLLOW_REQUEST: 'follow_request',
  FOLLOW_ACCEPTED: 'follow_accepted',
  ATTEND: 'attend',          // asistencia a evento
  POST_LIKE: 'post_like',    // like en publicación
  POST_COMMENT: 'post_comment', // comentario en publicación
  NEW_EVENT: 'new_event',    // usuario seguido creó un evento
  NEW_POST: 'new_post',      // usuario seguido creó una publicación
};

export const subscribeToNotifications = (userId, callback) => {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'notifications'),
    where('toUserId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(100)
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(notifications);
  });
};

export const createNotification = async (notificationData) => {
  try {
    if (notificationData.fromUserId === notificationData.toUserId) {
      return null;
    }

    const docRef = await addDoc(collection(db, 'notifications'), {
      ...notificationData,
      read: false,
      createdAt: new Date().toISOString(),
    });
    return docRef.id;
  } catch (error) {
    // error silenciado en producción
    throw error;
  }
};

export const markAsRead = async (notificationId) => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, { read: true });
  } catch (error) {
    // error silenciado
    throw error;
  }
};

export const markAllAsRead = async (userId) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('toUserId', '==', userId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(q);
    const batch = writeBatch(db);

    snapshot.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, { read: true });
    });

    await batch.commit();
  } catch (error) {
    // error silenciado
    throw error;
  }
};

// Notifica a una lista de seguidores (máx 20 a la vez para no saturar)
export const notifyFollowers = async (followerIds = [], notificationData) => {
  if (!followerIds.length) return;
  const batch = followerIds.slice(0, 20);
  await Promise.allSettled(
    batch.map(followerId =>
      createNotification({ ...notificationData, toUserId: followerId })
    )
  );
};

export const deleteNotification = async (notificationId) => {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (error) {
    console.error('Error al eliminar notificacion:', error);
    throw error;
  }
};
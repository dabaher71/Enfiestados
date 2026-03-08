import { addDoc, collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';

export const NOTIFICATION_TYPES = {
  LIKE: 'like',
  COMMENT: 'comment',
  FOLLOW: 'follow',
  FOLLOW_REQUEST: 'follow_request',
  FOLLOW_ACCEPTED: 'follow_accepted',
  ATTEND: 'attend',
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
    console.error('Error al crear notificacion:', error);
    throw error;
  }
};

export const markAsRead = async (notificationId) => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, { read: true });
  } catch (error) {
    console.error('Error al marcar como leida:', error);
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
    console.error('Error al marcar todas como leidas:', error);
    throw error;
  }
};

export const deleteNotification = async (notificationId) => {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (error) {
    console.error('Error al eliminar notificacion:', error);
    throw error;
  }
};
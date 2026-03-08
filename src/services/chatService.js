import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const chatsCollection = collection(db, 'chats');
const messagesCollection = collection(db, 'messages');

// Obtener o crear chat entre dos usuarios
export const getOrCreateChat = async (userId1, userId2) => {
  try {
    // Buscar chat existente
    const q = query(
      chatsCollection,
      where('participants', 'array-contains', userId1)
    );
    
    const snapshot = await getDocs(q);
    
    // Buscar si existe chat con el otro usuario
    const existingChat = snapshot.docs.find(doc => {
      const data = doc.data();
      return data.participants.includes(userId2);
    });

    if (existingChat) {
      return { id: existingChat.id, ...existingChat.data() };
    }

    // Crear nuevo chat
    const newChat = await addDoc(chatsCollection, {
      participants: [userId1, userId2],
      lastMessage: '',
      lastMessageTime: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    return { 
      id: newChat.id, 
      participants: [userId1, userId2],
      lastMessage: '',
      lastMessageTime: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error al obtener/crear chat:', error);
    throw error;
  }
};

// Escuchar chats de un usuario
export const subscribeToChats = (userId, callback) => {
  const q = query(
    chatsCollection,
    where('participants', 'array-contains', userId),
    orderBy('lastMessageTime', 'desc'),
    limit(50)
  );

  return onSnapshot(q, (snapshot) => {
    const chats = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(chats);
  });
};

// Escuchar mensajes de un chat
export const subscribeToMessages = (chatId, callback) => {
  const q = query(
    messagesCollection,
    where('chatId', '==', chatId),
    orderBy('timestamp', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(messages);
  });
};

// Enviar mensaje
export const sendMessage = async (chatId, senderId, text) => {
  try {
    // Agregar mensaje
    await addDoc(messagesCollection, {
      chatId,
      senderId,
      text,
      timestamp: new Date().toISOString(),
      read: false,
    });

    // Actualizar último mensaje del chat
    await updateDoc(doc(db, 'chats', chatId), {
      lastMessage: text,
      lastMessageTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    throw error;
  }
};

// Marcar mensajes como leídos
export const markMessagesAsRead = async (chatId, userId) => {
  try {
    const q = query(
      messagesCollection,
      where('chatId', '==', chatId),
      where('senderId', '!=', userId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(q);
    
    const promises = snapshot.docs.map(docSnap => 
      updateDoc(doc(db, 'messages', docSnap.id), { read: true })
    );

    await Promise.all(promises);
  } catch (error) {
    console.error('Error al marcar como leídos:', error);
  }
};

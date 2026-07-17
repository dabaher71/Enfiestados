import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const chatsCollection = collection(db, 'chats');
const messagesCollection = collection(db, 'messages');

const MAX_MESSAGE_LENGTH = 1000;

// ID determinista: evita chats duplicados por race condition
const getChatId = (uid1, uid2) => [uid1, uid2].sort().join('_');

export const getOrCreateChat = async (userId1, userId2) => {
  const chatId = getChatId(userId1, userId2);
  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);

  if (chatSnap.exists()) {
    return { id: chatSnap.id, ...chatSnap.data() };
  }

  const newChat = {
    participants: [userId1, userId2],
    lastMessage: '',
    lastMessageTime: new Date().toISOString(),
    createdAt: serverTimestamp(),
  };
  await setDoc(chatRef, newChat);
  return { id: chatId, ...newChat };
};

export const subscribeToChats = (userId, callback) => {
  const q = query(
    chatsCollection,
    where('participants', 'array-contains', userId),
    orderBy('lastMessageTime', 'desc'),
    limit(50)
  );
  return onSnapshot(q, (snapshot) => {
    const chats = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(chats);
  });
};

export const subscribeToMessages = (chatId, callback) => {
  const q = query(
    messagesCollection,
    where('chatId', '==', chatId),
    orderBy('timestamp', 'asc'),
    limit(100)
  );
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(messages);
  });
};

export const sendMessage = async (chatId, senderId, text) => {
  if (!text || !text.trim()) throw new Error('Mensaje vacío');
  const trimmed = text.trim().slice(0, MAX_MESSAGE_LENGTH);

  // Obtener participantes para marcar al receptor con mensaje no leído
  const chatSnap = await getDoc(doc(db, 'chats', chatId));
  const participants = chatSnap.exists() ? chatSnap.data().participants : [];
  const unreadFor = participants.filter(id => id !== senderId);

  const messagesRef = collection(db, 'messages');
  await setDoc(doc(messagesRef), {
    chatId,
    senderId,
    text: trimmed,
    timestamp: new Date().toISOString(),
    read: false,
  });

  await updateDoc(doc(db, 'chats', chatId), {
    lastMessage: trimmed.length > 60 ? trimmed.slice(0, 60) + '…' : trimmed,
    lastMessageTime: new Date().toISOString(),
    unreadFor,
  });
};

export const markMessagesAsRead = async (chatId, userId) => {
  try {
    const q = query(
      messagesCollection,
      where('chatId', '==', chatId),
      where('senderId', '!=', userId),
      where('read', '==', false)
    );
    const snapshot = await getDocs(q);
    await Promise.all([
      ...snapshot.docs.map(d => updateDoc(doc(db, 'messages', d.id), { read: true })),
      // Remover al usuario del array unreadFor del chat
      updateDoc(doc(db, 'chats', chatId), {
        unreadFor: (await getDoc(doc(db, 'chats', chatId)))
          .data()?.unreadFor?.filter(id => id !== userId) ?? [],
      }),
    ]);
  } catch (_) {
    // No crítico — marcar como leído puede fallar silenciosamente
  }
};

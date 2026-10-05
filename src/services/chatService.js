import {
  addDoc,
  arrayRemove,
  arrayUnion,
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

// Un chat es 'direct' (1 a 1) o 'group'. Los chats creados antes de que
// existieran los grupos no tienen el campo `type` — por eso en toda la app se
// pregunta `type === 'group'` y cualquier otra cosa cuenta como directo.
export const isGroupChat = (chat) => chat?.type === 'group';

// Permiso de escritura de un grupo: 'all' (cualquier miembro) u 'owner' (solo
// el dueño, para usarlo como canal de avisos). Los grupos sin el campo son
// 'all'. En directos no aplica.
export const canWriteInChat = (chat, uid) => {
  if (!isGroupChat(chat)) return true;
  if ((chat.writePolicy ?? 'all') === 'all') return true;
  return chat.ownerId === uid;
};

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
    type: 'direct',
    participants: [userId1, userId2],
    lastMessage: '',
    lastMessageTime: new Date().toISOString(),
    createdAt: serverTimestamp(),
  };
  await setDoc(chatRef, newChat);
  return { id: chatId, ...newChat };
};

const MAX_GROUP_NAME = 60;
export const MAX_GROUP_PARTICIPANTS = 100;

// Los grupos usan auto-ID: el ID determinista de los directos existe para
// evitar duplicados entre dos personas, pero dos grupos con los mismos
// miembros son grupos distintos y legítimos.
export const createGroupChat = async (ownerId, name, participantIds, writePolicy = 'all') => {
  const trimmed = (name || '').trim().slice(0, MAX_GROUP_NAME);
  if (!trimmed) throw new Error('El grupo necesita un nombre');

  // El dueño siempre adentro, sin repetidos.
  const participants = [...new Set([ownerId, ...participantIds])];
  if (participants.length < 2) throw new Error('Agregá al menos una persona');
  if (participants.length > MAX_GROUP_PARTICIPANTS) {
    throw new Error(`Máximo ${MAX_GROUP_PARTICIPANTS} personas por grupo`);
  }

  const ref = await addDoc(chatsCollection, {
    type: 'group',
    name: trimmed,
    ownerId,
    writePolicy: writePolicy === 'owner' ? 'owner' : 'all',
    participants,
    lastMessage: '',
    lastMessageTime: new Date().toISOString(),
    unreadFor: [],
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const updateGroupSettings = async (chatId, { name, writePolicy }) => {
  const patch = {};
  if (name !== undefined) {
    const trimmed = name.trim().slice(0, MAX_GROUP_NAME);
    if (!trimmed) throw new Error('El grupo necesita un nombre');
    patch.name = trimmed;
  }
  if (writePolicy !== undefined) {
    patch.writePolicy = writePolicy === 'owner' ? 'owner' : 'all';
  }
  if (Object.keys(patch).length === 0) return;
  await updateDoc(doc(db, 'chats', chatId), patch);
};

export const addParticipants = async (chatId, uids) => {
  if (!uids?.length) return;
  await updateDoc(doc(db, 'chats', chatId), {
    participants: arrayUnion(...uids),
  });
};

// Sirve para que alguien se vaya solo y para que el dueño saque a alguien —
// las reglas distinguen los dos casos.
export const removeParticipant = async (chatId, uid) => {
  await updateDoc(doc(db, 'chats', chatId), {
    participants: arrayRemove(uid),
    unreadFor: arrayRemove(uid),
  });
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

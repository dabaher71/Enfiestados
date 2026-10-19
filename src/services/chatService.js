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
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../config/firebase';

const chatsCollection = collection(db, 'chats');
const messagesCollection = collection(db, 'messages');

const MAX_MESSAGE_LENGTH = 1000;
const CHAT_PHOTO_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_CHAT_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB, igual que storage.rules

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

  // docRef y no `ref`: este módulo ahora importa `ref` de firebase/storage y
  // una variable local con ese nombre lo sombrea dentro de la función.
  const docRef = await addDoc(chatsCollection, {
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
  return docRef.id;
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

// Quién puede mandar fotos. En un directo, cualquiera de los dos. En un grupo,
// solo el dueño — es el "admin" del grupo. Se deja aparte de canWriteInChat
// porque son permisos distintos: en un grupo con writePolicy 'all' todos
// escriben texto, pero las fotos siguen siendo solo del dueño.
export const canSendPhotoInChat = (chat, uid) => {
  if (!isGroupChat(chat)) return true;
  return chat?.ownerId === uid;
};

// Sube una foto para mandarla por chat y devuelve su URL. La ruta lleva el uid
// de quien sube porque storage.rules no puede consultar Firestore para saber
// si pertenece al chat; ese control vive en las reglas del mensaje.
export const uploadChatPhoto = async (uri, uid) => {
  const blob = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload  = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error('No se pudo leer la imagen'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
  try {
    if (!CHAT_PHOTO_MIME.includes(blob.type)) {
      throw new Error('Solo se aceptan imágenes JPG, PNG, WebP o GIF.');
    }
    if (blob.size > MAX_CHAT_PHOTO_BYTES) {
      throw new Error('La imagen supera el límite de 5 MB.');
    }
    const id = doc(collection(db, '_')).id;
    const photoRef = ref(storage, `chats/${uid}/${id}`);
    await uploadBytes(photoRef, blob, { contentType: blob.type });
    return await getDownloadURL(photoRef);
  } finally {
    blob.close?.();
  }
};

// `imageUrl` es opcional. Un mensaje vale si trae texto, imagen, o ambos.
export const sendMessage = async (chatId, senderId, text, imageUrl = null) => {
  const trimmed = (text ?? '').trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!trimmed && !imageUrl) throw new Error('Mensaje vacío');

  // Obtener participantes para marcar al receptor con mensaje no leído
  const chatSnap = await getDoc(doc(db, 'chats', chatId));
  const participants = chatSnap.exists() ? chatSnap.data().participants : [];
  const unreadFor = participants.filter(id => id !== senderId);

  const messagesRef = collection(db, 'messages');
  await setDoc(doc(messagesRef), {
    chatId,
    senderId,
    // Siempre string, aunque vaya vacío: las reglas exigen que `text` exista y
    // sea string, y una foto sin pie es un caso válido.
    text: trimmed,
    ...(imageUrl ? { imageUrl } : {}),
    timestamp: new Date().toISOString(),
    read: false,
  });

  // Vista previa en la lista de chats: sin texto, se anuncia la foto, para que
  // la conversación no aparezca en blanco.
  const preview = trimmed
    ? (trimmed.length > 60 ? trimmed.slice(0, 60) + '…' : trimmed)
    : '📷 Foto';

  await updateDoc(doc(db, 'chats', chatId), {
    lastMessage: preview,
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

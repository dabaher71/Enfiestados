import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '../config/firebase';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

// Hasta 3 medios por publicación, de los cuales como máximo 1 puede ser video.
// El video todavía no está habilitado: reproducirlo necesita expo-video, que es
// un módulo nativo y obliga a reconstruir la app. El modelo de datos ya lo
// contempla (cada medio lleva su `type`) para que activarlo después no implique
// migrar las publicaciones ya creadas.
export const MAX_POST_MEDIA = 3;
export const MAX_POST_VIDEOS = 1;
export const VIDEO_ENABLED = false;

// Sube un archivo y devuelve { type, url }. Valida el MIME real del blob, no la
// extensión del nombre, que es falsificable.
const uploadOne = async (uri, uid) => {
  const blob = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error('Error al leer el archivo'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });

  try {
    if (!ALLOWED_MIME_TYPES.includes(blob.type)) {
      throw new Error('Tipo de archivo no permitido. Solo se aceptan imágenes JPG, PNG, WebP o GIF.');
    }
    if (blob.size > MAX_IMAGE_BYTES) {
      throw new Error('La imagen supera el límite de 5 MB.');
    }
    // ID criptográfico usando Firestore auto-ref
    const mediaId = doc(collection(db, '_')).id;
    const mediaRef = ref(storage, `posts/${uid}/${mediaId}`);
    await uploadBytes(mediaRef, blob, { contentType: blob.type });
    return { type: 'image', url: await getDownloadURL(mediaRef) };
  } finally {
    blob.close?.();
  }
};

// `media` es un arreglo de URIs locales. Se mantiene `image` como parámetro
// suelto por compatibilidad con las pantallas que todavía mandan una sola.
export const createPost = async ({ text, image, media }) => {
  const user = auth.currentUser;
  if (!user) throw new Error('No autenticado');
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const userData = userDoc.exists() ? userDoc.data() : {};

  const uris = (media?.length ? media : image ? [image] : []).slice(0, MAX_POST_MEDIA);
  if ((media?.length ?? 0) > MAX_POST_MEDIA) {
    throw new Error(`Podés subir hasta ${MAX_POST_MEDIA} archivos por publicación.`);
  }

  // En serie y no en paralelo: subir tres archivos a la vez en una conexión
  // móvil hace que los tres vayan lentos y que un fallo deje archivos
  // huérfanos a medio subir. Si uno falla, se corta antes de los siguientes.
  const uploaded = [];
  for (const uri of uris) uploaded.push(await uploadOne(uri, user.uid));

  const postData = {
    userId: user.uid,
    userName: userData.name || 'Usuario',
    userAvatar: userData.avatar || null,
    text: text ? text.slice(0, 1000) : '',
    media: uploaded,
    // `image` se sigue escribiendo con el primer medio: las publicaciones
    // viejas lo usan y hay consumidores que todavía leen ese campo.
    image: uploaded[0]?.url ?? null,
    likes: [],
    comments: [],
    createdAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, 'posts'), postData);
  return { id: docRef.id, ...postData };
};

// Lee los medios de una publicación en cualquiera de los dos formatos: el
// arreglo `media` nuevo o el `image` suelto de las publicaciones anteriores.
export const getPostMedia = (post) => {
  if (post?.media?.length) return post.media;
  return post?.image ? [{ type: 'image', url: post.image }] : [];
};

export const subscribeToUserPosts = (userId, callback) => {
  const q = query(
    collection(db, 'posts'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(posts);
  }, () => callback([]));
};

// Toggle like en post — transacción atómica + notificación al autor
export const togglePostLike = async (postId, userId) => {
  const postRef = doc(db, 'posts', postId);
  const newLikes = await runTransaction(db, async (tx) => {
    const snap = await tx.get(postRef);
    if (!snap.exists()) throw new Error('Publicación no encontrada');
    const likes = snap.data().likes || [];
    const updated = likes.includes(userId)
      ? likes.filter(id => id !== userId)
      : [...likes, userId];
    tx.update(postRef, { likes: updated });
    return { likes: updated, ownerId: snap.data().userId, added: !likes.includes(userId) };
  });
  return newLikes;
};

// Agregar comentario en post — transacción atómica
export const addPostComment = async (postId, comment) => {
  const postRef = doc(db, 'posts', postId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(postRef);
    if (!snap.exists()) throw new Error('Publicación no encontrada');
    const comments = snap.data().comments || [];
    const newComment = {
      id: doc(collection(db, '_')).id,
      ...comment,
      text: comment.text.slice(0, 500),
      createdAt: new Date().toISOString(),
    };
    tx.update(postRef, { comments: [...comments, newComment] });
    return { comment: newComment, ownerId: snap.data().userId };
  });
};

export const deletePost = async (postId, userId) => {
  const postRef = doc(db, 'posts', postId);
  const postSnap = await getDoc(postRef);
  if (!postSnap.exists() || postSnap.data().userId !== userId) {
    throw new Error('No tienes permiso para eliminar esta publicación');
  }
  await deleteDoc(postRef);
};

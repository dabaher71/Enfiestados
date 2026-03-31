import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '../config/firebase';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export const createPost = async ({ text, image }) => {
  const user = auth.currentUser;
  if (!user) throw new Error('No autenticado');
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const userData = userDoc.exists() ? userDoc.data() : {};

  let imageUrl = null;
  if (image) {
    try {
      const blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new Error('Error al leer imagen'));
        xhr.responseType = 'blob';
        xhr.open('GET', image, true);
        xhr.send(null);
      });

      // Validación de tipo MIME real
      if (!ALLOWED_MIME_TYPES.includes(blob.type)) {
        throw new Error('Tipo de archivo no permitido. Solo se aceptan imágenes JPG, PNG, WebP o GIF.');
      }
      if (blob.size > MAX_IMAGE_BYTES) {
        throw new Error('La imagen supera el límite de 5 MB.');
      }

      // ID criptográfico usando Firestore auto-ref
      const imageId = doc(collection(db, '_')).id;
      const imageRef = ref(storage, `posts/${user.uid}/${imageId}`);
      await uploadBytes(imageRef, blob, { contentType: blob.type });
      imageUrl = await getDownloadURL(imageRef);
      blob.close?.();
    } catch (e) {
      throw e; // propagar para que el caller muestre el error
    }
  }

  const postData = {
    userId: user.uid,
    userName: userData.name || 'Usuario',
    userAvatar: userData.avatar || null,
    text: text ? text.slice(0, 1000) : '',
    image: imageUrl,
    likes: [],
    comments: [],
    createdAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, 'posts'), postData);
  return { id: docRef.id, ...postData };
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

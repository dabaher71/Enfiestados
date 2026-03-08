import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../config/firebase';

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
      const imageRef = ref(storage, 'posts/' + user.uid + '/' + Date.now() + '.jpg');
      await uploadBytes(imageRef, blob);
      imageUrl = await getDownloadURL(imageRef);
      blob.close();
    } catch (e) {
      console.error('Image upload error:', e);
    }
  }

  const postData = {
    userId: user.uid,
    userName: userData.name || 'Usuario',
    userAvatar: userData.avatar || null,
    text: text || '',
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
  }, (error) => {
    console.error('Error en posts:', error);
    callback([]);
  });
};

export const deletePost = async (postId) => {
  await deleteDoc(doc(db, 'posts', postId));
};

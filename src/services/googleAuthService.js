import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

GoogleSignin.configure({
  webClientId: '211216248478-vnd4avn6mf7pn9tqhhbm6ercfmkqb4b0.apps.googleusercontent.com',
  iosClientId: '211216248478-3h0pjmcm66d8bf59r6m6eh0aeiagbk7h.apps.googleusercontent.com',
});

export async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const signInResult = await GoogleSignin.signIn();
  const idToken = signInResult.data?.idToken ?? signInResult.idToken;

  if (!idToken) throw new Error('No se pudo obtener el token de Google');

  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(auth, credential);
  const user = userCredential.user;

  // Crear perfil en Firestore solo si es la primera vez
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      name: user.displayName ?? 'Usuario',
      email: user.email ?? '',
      avatar: user.photoURL ?? '',
      coverImage: '',
      bio: '',
      location: '',
      interests: [],
      followers: [],
      following: [],
      followRequests: [],
      eventsOrganized: [],
      eventsAttending: [],
      perfilPublico: true,
      verificado: false,
      usuariosBloqueados: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return user;
}

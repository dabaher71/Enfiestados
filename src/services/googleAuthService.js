import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, linkWithCredential, signInWithCredential } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

GoogleSignin.configure({
  webClientId: '211216248478-vnd4avn6mf7pn9tqhhbm6ercfmkqb4b0.apps.googleusercontent.com',
  iosClientId: '211216248478-3h0pjmcm66d8bf59r6m6eh0aeiagbk7h.apps.googleusercontent.com',
});

// Devuelve { user, mergedWithExisting }. mergedWithExisting = true cuando
// quien llamaba era un invitado (§ 8a) y esa cuenta de Google ya pertenece
// a otra cuenta real — ahí entramos con esa y los datos de la sesión de
// invitado se descartan (el caller debe avisarlo).
export async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const signInResult = await GoogleSignin.signIn();
  const idToken = signInResult.data?.idToken ?? signInResult.idToken;

  if (!idToken) throw new Error('No se pudo obtener el token de Google');

  const credential = GoogleAuthProvider.credential(idToken);
  const anonUser = auth.currentUser?.isAnonymous ? auth.currentUser : null;

  let user;
  let mergedWithExisting = false;

  if (anonUser) {
    try {
      // linkWithCredential conserva el uid anónimo — lo que ya guardó/
      // confirmó como invitado (savedBy/attendees con ese uid) no se pierde.
      user = (await linkWithCredential(anonUser, credential)).user;
    } catch (e) {
      if (e.code === 'auth/credential-already-in-use' || e.code === 'auth/email-already-in-use') {
        user = (await signInWithCredential(auth, credential)).user;
        mergedWithExisting = true;
      } else {
        throw e;
      }
    }
  } else {
    user = (await signInWithCredential(auth, credential)).user;
  }

  // Crear perfil en Firestore solo si es la primera vez (nunca existe para
  // un uid recién linkeado; si mergedWithExisting, el doc ya existe).
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

  return { user, mergedWithExisting };
}

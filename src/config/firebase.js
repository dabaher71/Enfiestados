import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCHtnWdRm5-uR4Vfl56wkszsayuVm52tCc",
  authDomain: "enfiestados-alpha.firebaseapp.com",
  projectId: "enfiestados-alpha",
  storageBucket: "enfiestados-alpha.firebasestorage.app",
  messagingSenderId: "211216248478",
  appId: "1:211216248478:web:63daa32a5c942c2981558f"
};

// Inicializar Firebase solo si no existe
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Auth con persistencia
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (error) {
  auth = getAuth(app);
}

const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
export default app;
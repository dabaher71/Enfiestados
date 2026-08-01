import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { auth, db } from '../config/firebase';

import ErrorBoundary from '../components/ErrorBoundary';
import LoadingScreen from '../components/LoadingScreen';
import ChatDetailScreen from '../screens/ChatDetailScreen';
import EditEventScreen from '../screens/EditEventScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import SettingsScreen from '../screens/SettingsScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import MainTabNavigator from './MainTabNavigator';
import CreatePostScreen from '../screens/CreatePostScreen';
import AdminScreen from '../screens/AdminScreen';
import AdCenterScreen from '../screens/AdCenterScreen';
import CreateAdScreen from '../screens/CreateAdScreen';
import AdvertiserRequestScreen from '../screens/AdvertiserRequestScreen';
import InterestsScreen from '../screens/InterestsScreen';
import CreateEventScreen from '../screens/CreateEventScreen';
import ExternalEventDetailScreen from '../screens/ExternalEventDetailScreen';
import MessagesScreen from '../screens/MessagesScreen';
import NotificationsSettingsScreen from '../screens/NotificationsSettingsScreen';
import OrganizerPanelScreen from '../screens/OrganizerPanelScreen';
import DevCatalogScreen from '../screens/DevCatalogScreen';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

export default function AppNavigator() {
  const [user, setUser] = useState(undefined);      // undefined = cargando auth
  const [hasInterests, setHasInterests] = useState(undefined); // undefined = cargando Firestore
  const unsubscribeRef = useRef(null);
  // null = todavía no sabemos; true/false = si el currentUser anterior era anónimo.
  // Sirve para detectar la transición invitado → cuenta real (ver abajo).
  const wasAnonymousRef = useRef(null);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setHasInterests(true);
      return;
    }
    unsubscribeRef.current = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        // Sesión terminada (o arranque en frío). Si YA había una sesión
        // montada (real o anónima), hay que sacarla de la UI ya mismo: si
        // no, pantallas que leen auth.currentUser directo (ej.
        // ProfileScreen) truenan con "Cannot read property 'uid' of null"
        // — auth.currentUser YA es null acá aunque el estado de React
        // todavía no se enteró — y los listeners de Firestore que quedaron
        // abiertos bajo la sesión vieja tiran permission-denied. En el
        // arranque en frío (todavía no había nada montado, user===undefined)
        // no hace falta: el LoadingScreen ya cubre la espera.
        setUser(prev => (prev === undefined ? undefined : null));

        // § 8a — sin muro de login: en vez de mostrar el formulario, se entra
        // como invitado (Firebase Auth anónimo) directo al feed. Login/Register
        // quedan para cuando el invitado intente guardar/asistir/comentar/etc.
        // (ver requireAccount) o si esto falla (sin conexión).
        try {
          await signInAnonymously(auth);
        } catch {
          setUser(null);
          setHasInterests(true);
        }
        return; // signInAnonymously exitoso vuelve a disparar este callback
      }

      const wasAnonymous = wasAnonymousRef.current;
      wasAnonymousRef.current = currentUser.isAnonymous;
      setUser(currentUser);

      if (currentUser.isAnonymous) {
        setHasInterests(true);
        return;
      }

      updateDoc(doc(db, 'users', currentUser.uid), {
        lastActive: serverTimestamp(),
      }).catch(() => {});

      let interests = [];
      try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        interests = snap.data()?.interests ?? [];
      } catch {}
      setHasInterests(interests.length > 0);

      // Se acaba de autenticar como usuario real viniendo de Login/Register
      // (wasAnonymous es null la primera vez que este componente ve un
      // currentUser — cubre tanto "era invitado" como "nunca llegó a serlo",
      // ej. si signInAnonymously falló y cayó directo a LoginScreen). Ahí
      // Login/Register siguen registradas en el Stack (no desaparecen, ver
      // abajo), así que React Navigation no vuelve a evaluar initialRouteName
      // solo — hay que llevarlo a mano a MainApp o a Interests.
      // wasAnonymous === false (usuario real re-emitiendo el mismo estado,
      // ej. refresh de token) es el único caso que NO debe resetear la nav.
      if (wasAnonymous !== false && navigationRef.isReady()) {
        navigationRef.reset({
          index: 0,
          routes: [{ name: interests.length > 0 ? 'MainApp' : 'Interests' }],
        });
      }
    });
    return () => unsubscribeRef.current?.();
  }, []);

  // Esperar tanto auth como la verificación de intereses antes de renderizar
  if (user === undefined || (user && hasInterests === undefined)) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          screenOptions={{ headerShown: false }}
          initialRouteName={user ? (hasInterests ? 'MainApp' : 'Interests') : 'Login'}
        >
          {user ? (
            <>
              <Stack.Screen name="MainApp" component={MainTabNavigator} />
              <Stack.Screen name="Interests" component={InterestsScreen} options={{ gestureEnabled: false }} />
              <Stack.Screen name="EventDetail" component={EventDetailScreen} />
              <Stack.Screen
                name="ExternalEventDetail"
                component={ExternalEventDetailScreen}
                options={{ presentation: 'modal', headerShown: false }}
              />
              <Stack.Screen name="UserProfile" component={UserProfileScreen} />
              <Stack.Screen name="EditProfile" component={EditProfileScreen} />
              <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
              <Stack.Screen name="EditEvent" component={EditEventScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="CreatePost" component={CreatePostScreen} />
              <Stack.Screen name="Admin" component={AdminScreen} />
              <Stack.Screen name="AdCenter" component={AdCenterScreen} />
              <Stack.Screen name="CreateAd" component={CreateAdScreen} />
              <Stack.Screen name="AdvertiserRequest" component={AdvertiserRequestScreen} />
              <Stack.Screen name="Messages" component={MessagesScreen} />
              <Stack.Screen name="NotificationsSettings" component={NotificationsSettingsScreen} />
              <Stack.Screen name="OrganizerPanel" component={OrganizerPanelScreen} />
              {__DEV__ && <Stack.Screen name="DevCatalog" component={DevCatalogScreen} />}
              {/* CreateEvent como modal — oculta la barra de tabs */}
              <Stack.Screen
                name="CreateEvent"
                component={CreateEventScreen}
                options={{ presentation: 'modal', gestureEnabled: true }}
              />
            </>
          ) : null}
          {/* Login/Register/ForgotPassword: pantalla inicial si signInAnonymously
              falla (sin red), y destino de "Crear cuenta" cuando un invitado
              anónimo intenta guardar/asistir/comentar (ver requireAccount) —
              por eso quedan registradas también dentro del árbol autenticado. */}
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
  );
}

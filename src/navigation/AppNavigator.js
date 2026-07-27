import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { auth, db } from '../config/firebase';

import ErrorBoundary from '../components/ErrorBoundary';
import LoadingScreen from '../components/LoadingScreen';
import ChatDetailScreen from '../screens/ChatDetailScreen';
import ChatsScreen from '../screens/ChatsScreen';
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
import DevCatalogScreen from '../screens/DevCatalogScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [user, setUser] = useState(undefined);      // undefined = cargando auth
  const [hasInterests, setHasInterests] = useState(undefined); // undefined = cargando Firestore
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setHasInterests(true);
      return;
    }
    unsubscribeRef.current = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser ?? null);
      if (currentUser) {
        updateDoc(doc(db, 'users', currentUser.uid), {
          lastActive: serverTimestamp(),
        }).catch(() => {});

        try {
          const snap = await getDoc(doc(db, 'users', currentUser.uid));
          const interests = snap.data()?.interests ?? [];
          setHasInterests(interests.length > 0);
        } catch {
          setHasInterests(true);
        }
      } else {
        setHasInterests(true);
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
      <NavigationContainer>
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
              <Stack.Screen name="Chats" component={ChatsScreen} />
              <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
              <Stack.Screen name="EditEvent" component={EditEventScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="CreatePost" component={CreatePostScreen} />
              <Stack.Screen name="Admin" component={AdminScreen} />
              <Stack.Screen name="AdCenter" component={AdCenterScreen} />
              <Stack.Screen name="CreateAd" component={CreateAdScreen} />
              <Stack.Screen name="AdvertiserRequest" component={AdvertiserRequestScreen} />
              <Stack.Screen name="Messages" component={MessagesScreen} />
              {__DEV__ && <Stack.Screen name="DevCatalog" component={DevCatalogScreen} />}
              {/* CreateEvent como modal — oculta la barra de tabs */}
              <Stack.Screen
                name="CreateEvent"
                component={CreateEventScreen}
                options={{ presentation: 'modal', gestureEnabled: true }}
              />
            </>
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
              <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
  );
}

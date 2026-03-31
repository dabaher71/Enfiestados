import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import { auth } from '../config/firebase';

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

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [user, setUser] = useState(undefined); // undefined = todavía no sabemos
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      return;
    }
    unsubscribeRef.current = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser ?? null);
    });
    return () => unsubscribeRef.current?.();
  }, []);

  // Mientras Firebase no responde aún
  if (user === undefined) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            <>
              <Stack.Screen name="MainApp" component={MainTabNavigator} />
              <Stack.Screen name="EventDetail" component={EventDetailScreen} />
              <Stack.Screen name="UserProfile" component={UserProfileScreen} />
              <Stack.Screen name="EditProfile" component={EditProfileScreen} />
              <Stack.Screen name="Chats" component={ChatsScreen} />
              <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
              <Stack.Screen name="EditEvent" component={EditEventScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="CreatePost" component={CreatePostScreen} />
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

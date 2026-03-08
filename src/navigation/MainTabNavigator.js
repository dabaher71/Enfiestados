import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebase';

import CreateEventScreen from '../screens/CreateEventScreen';
import HomeScreen from '../screens/HomeScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SearchScreen from '../screens/SearchScreen';

const Tab = createBottomTabNavigator();

const PURPLE = '#6c5ce7';
const DARK_BG = '#1a1a2e';
const BORDER = '#2d2d44';
const INACTIVE = '#666';

// Badge de notificaciones no leídas
function NotificationIcon({ focused, color, size, count }) {
  const iconName = focused ? 'notifications' : 'notifications-outline';
  return (
    <View>
      <Ionicons name={iconName} size={size} color={color} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </View>
  );
}

// Icono central "Crear" con fondo destacado
function CreateIcon({ focused, size }) {
  return (
    <View style={[styles.createButton, focused && styles.createButtonActive]}>
      <Ionicons
        name="add"
        size={size + 2}
        color={focused ? '#fff' : PURPLE}
      />
    </View>
  );
}

export default function MainTabNavigator() {
  const insets = useSafeAreaInsets();
  const [unreadCount, setUnreadCount] = useState(0);
  const userId = auth.currentUser?.uid;

  // Suscripción en tiempo real a notificaciones no leídas
  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'notifications'),
      where('toUserId', '==', userId),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.docs.length);
    });

    return () => unsubscribe();
  }, [userId]);

  // Altura dinámica: respeta el home indicator (iOS) y el notch inferior (Android)
  const tabBarHeight = Platform.select({
    android: 60 + insets.bottom,
    ios: 50 + insets.bottom,
  });

  const tabBarPaddingBottom = Platform.select({
    android: insets.bottom > 0 ? insets.bottom : 8,
    ios: insets.bottom > 0 ? insets.bottom : 10,
  });

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,

        // Estilos base de la barra
        tabBarStyle: {
          backgroundColor: DARK_BG,
          borderTopColor: BORDER,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 8,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.35,
          shadowRadius: 6,
        },

        tabBarActiveTintColor: PURPLE,
        tabBarInactiveTintColor: INACTIVE,

        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },

        // Fondo de item activo sutil
        tabBarItemStyle: {
          borderRadius: 12,
          marginHorizontal: 2,
        },

        tabBarIcon: ({ focused, color, size }) => {
          switch (route.name) {
            case 'Home':
              return (
                <Ionicons
                  name={focused ? 'home' : 'home-outline'}
                  size={size}
                  color={color}
                />
              );
            case 'Search':
              return (
                <Ionicons
                  name={focused ? 'search' : 'search-outline'}
                  size={size}
                  color={color}
                />
              );
            case 'Create':
              return <CreateIcon focused={focused} size={size} />;
            case 'Notifications':
              return (
                <NotificationIcon
                  focused={focused}
                  color={color}
                  size={size}
                  count={unreadCount}
                />
              );
            case 'Profile':
              return (
                <Ionicons
                  name={focused ? 'person' : 'person-outline'}
                  size={size}
                  color={color}
                />
              );
            default:
              return null;
          }
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: 'Inicio' }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{ tabBarLabel: 'Buscar' }}
      />
      <Tab.Screen
        name="Create"
        component={CreateEventScreen}
        options={{
          tabBarLabel: () => null,
          tabBarShowLabel: false,
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ tabBarLabel: 'Alertas' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Perfil' }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  // Badge de notificaciones
  badge: {
    position: 'absolute',
    right: -8,
    top: -4,
    backgroundColor: '#e74c3c',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: DARK_BG,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    lineHeight: 12,
  },

  // Botón "Crear" destacado
  createButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: PURPLE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonActive: {
    backgroundColor: PURPLE,
    borderColor: PURPLE,
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
});

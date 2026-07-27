import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebase';
import { useTheme } from '../theme/ThemeProvider';

import HomeScreen from '../screens/HomeScreen';
import MyPlansScreen from '../screens/MyPlansScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SearchScreen from '../screens/SearchScreen';

const Tab = createBottomTabNavigator();

// Badge contador de no leídos (notificaciones + chats)
function UnreadBadge({ count, bgColor, borderColor }) {
  if (count <= 0) return null;
  return (
    <View style={[styles.badge, { backgroundColor: bgColor, borderColor }]}>
      <View style={styles.badgeInner}>
        {/* Usamos Text de RN acá porque este componente vive fuera del ThemeProvider render tree */}
        <Ionicons name="ellipse" size={0} />
      </View>
    </View>
  );
}

export default function MainTabNavigator() {
  const insets   = useSafeAreaInsets();
  const { colors } = useTheme();
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadChats,  setUnreadChats]  = useState(0);
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'notifications'), where('toUserId', '==', userId), where('read', '==', false));
    const unsub = onSnapshot(q, snap => setUnreadNotifs(snap.docs.length));
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'chats'), where('participants', 'array-contains', userId));
    const unsub = onSnapshot(q, snap => {
      setUnreadChats(snap.docs.filter(d => d.data().unreadFor?.includes(userId)).length);
    });
    return () => unsub();
  }, [userId]);

  const totalUnread = useMemo(() => unreadNotifs + unreadChats, [unreadNotifs, unreadChats]);

  const tabBarHeight = 60 + Math.max(insets.bottom, 0);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors['bg.base'],
          borderTopColor: colors['border.subtle'],
          borderTopWidth: StyleSheet.hairlineWidth,
          height: tabBarHeight,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          elevation: 12,
          shadowColor: colors['bg.overlay'],
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.35,
          shadowRadius: 6,
        },
        tabBarActiveTintColor:   colors['action.primary'],
        tabBarInactiveTintColor: colors['text.tertiary'],
        tabBarLabelStyle: {
          fontSize: 11.5,
          fontFamily: 'PlusJakartaSans_600SemiBold',
          marginTop: 2,
        },
        tabBarItemStyle: { borderRadius: 12, marginHorizontal: 2 },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Home:          focused ? 'home'          : 'home-outline',
            Explore:       focused ? 'search'        : 'search-outline',
            MyPlans:       focused ? 'bookmark'      : 'bookmark-outline',
            Notifications: focused ? 'notifications' : 'notifications-outline',
            Profile:       focused ? 'person'        : 'person-outline',
          };
          const name = icons[route.name];
          if (route.name === 'Notifications') {
            return (
              <View>
                <Ionicons name={name} size={size} color={color} />
                {unreadNotifs > 0 && (
                  <View style={[styles.badge, { backgroundColor: colors['status.urgent'], borderColor: colors['bg.base'] }]}>
                    <Ionicons name="ellipse" size={0} />
                  </View>
                )}
              </View>
            );
          }
          return <Ionicons name={name} size={26} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home"          component={HomeScreen}          options={{ tabBarLabel: 'Inicio' }} />
      <Tab.Screen name="Explore"       component={SearchScreen}        options={{ tabBarLabel: 'Explorar' }} />
      <Tab.Screen name="MyPlans"       component={MyPlansScreen}       options={{ tabBarLabel: 'Mis planes' }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} options={{ tabBarLabel: 'Alertas' }} />
      <Tab.Screen name="Profile"       component={ProfileScreen}       options={{ tabBarLabel: 'Perfil' }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: -5,
    top: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  badgeInner: { flex: 1 },
});

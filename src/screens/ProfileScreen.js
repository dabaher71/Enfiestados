import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EventCard from '../components/EventCard';
import PostCard from '../components/PostCard';
import { auth, db } from '../config/firebase';
import { subscribeToEvents } from '../services/eventService';
import { subscribeToUserPosts } from '../services/postService';

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('eventos');

  const currentUser = auth.currentUser;

  useEffect(() => {
    loadUser();
    const unsubscribeEvents = loadUserEvents();
    let unsubscribePosts;
    try {
      unsubscribePosts = subscribeToUserPosts(currentUser.uid, (userPosts) => {
        setPosts(userPosts);
      });
    } catch (error) {
      console.error('Error posts:', error);
    }

    const focusUnsub = navigation.addListener('focus', () => {
      setLoading(true);
      loadUser();
    });

    return () => {
      unsubscribeEvents && unsubscribeEvents();
      unsubscribePosts && unsubscribePosts();
      focusUnsub && focusUnsub();
    };
  }, []);

  const loadUser = async () => {
    try {
      setLoading(true);
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        setUser(userDoc.data());
      }
    } catch (error) {
      console.error('Error al cargar usuario:', error);
    }
    setLoading(false);
  };

  const loadUserEvents = () => {
    return subscribeToEvents((allEvents) => {
      const userEvents = allEvents.filter(event => event.organizerId === currentUser.uid);
      setEvents(userEvents);
    });
  };

  const handleEventPress = useCallback((event) => {
    navigation.navigate('EventDetail', { event });
  }, [navigation]);

  const handleUserPress = useCallback((userId) => {
    if (userId !== currentUser.uid) {
      navigation.navigate('UserProfile', { userId });
    }
  }, [navigation, currentUser.uid]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6c5ce7" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mi Perfil</Text>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="settings-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.coverContainer}>
          <Image source={user?.coverImage ? { uri: user.coverImage } : require('../../assets/images/icon.png')} style={styles.coverImage} />
        </View>

        <View style={styles.profileSection}>
          <Image source={user?.avatar ? { uri: user.avatar } : require('../../assets/images/icon.png')} style={styles.avatar} />
          <Text style={styles.name}>{user?.name || 'Usuario'}</Text>
          <Text style={styles.email}>{currentUser.email}</Text>
          {user?.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{events.length}</Text>
              <Text style={styles.statLabel}>Eventos</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{posts.length}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{user?.followers?.length || 0}</Text>
              <Text style={styles.statLabel}>Seguidores</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{user?.following?.length || 0}</Text>
              <Text style={styles.statLabel}>Siguiendo</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabsContainer}>
          <TouchableOpacity style={[styles.tab, activeTab === 'eventos' && styles.tabActive]} onPress={() => setActiveTab('eventos')}>
            <Ionicons name="calendar" size={22} color={activeTab === 'eventos' ? '#6c5ce7' : '#888'} />
            <Text style={[styles.tabText, activeTab === 'eventos' && styles.tabTextActive]}>Eventos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'publicaciones' && styles.tabActive]} onPress={() => setActiveTab('publicaciones')}>
            <Ionicons name="grid" size={22} color={activeTab === 'publicaciones' ? '#6c5ce7' : '#888'} />
            <Text style={[styles.tabText, activeTab === 'publicaciones' && styles.tabTextActive]}>Publicaciones</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.contentSection}>
          {activeTab === 'eventos' ? (
            events.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={50} color="#888" />
                <Text style={styles.emptyText}>No has creado eventos aún</Text>
                <TouchableOpacity style={styles.createButton} onPress={() => navigation.navigate('Create')}>
                  <Text style={styles.createButtonText}>Crear mi primer evento</Text>
                </TouchableOpacity>
              </View>
            ) : (
              events.map(event => (
                <EventCard key={event.id} event={event} onPress={() => handleEventPress(event)} />
              ))
            )
          ) : (
            <>
              <TouchableOpacity style={styles.createPostButton} onPress={() => navigation.navigate('CreatePost')}>
                <Ionicons name="add-circle" size={24} color="#6c5ce7" />
                <Text style={styles.createPostText}>Crear publicación</Text>
              </TouchableOpacity>
              {posts.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="chatbubbles-outline" size={50} color="#888" />
                  <Text style={styles.emptyText}>No tienes publicaciones aún</Text>
                  <Text style={styles.emptySubtext}>Comparte algo con tus seguidores</Text>
                </View>
              ) : (
                posts.map(post => (
                  <PostCard key={post.id} post={post} onUserPress={handleUserPress} />
                ))
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  loadingContainer: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  headerButton: { marginLeft: 15 },
  coverContainer: { height: 150, backgroundColor: '#2d2d44' },
  coverImage: { width: '100%', height: '100%' },
  profileSection: { alignItems: 'center', paddingHorizontal: 20, marginTop: -50 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#1a1a2e', backgroundColor: '#2d2d44' },
  name: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginTop: 15 },
  email: { fontSize: 14, color: '#888', marginTop: 4 },
  bio: { fontSize: 14, color: '#aaa', textAlign: 'center', marginTop: 10, paddingHorizontal: 20 },
  statsRow: { flexDirection: 'row', marginTop: 20, paddingHorizontal: 10 },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 4 },
  tabsContainer: { flexDirection: 'row', marginTop: 25, borderBottomWidth: 1, borderBottomColor: '#2d2d44' },
  tab: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 15 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#6c5ce7' },
  tabText: { color: '#888', fontSize: 14, fontWeight: '600', marginLeft: 8 },
  tabTextActive: { color: '#fff' },
  contentSection: { paddingVertical: 15, paddingBottom: 100 },
  createPostButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2d2d44', marginHorizontal: 15, marginBottom: 15, paddingVertical: 15, borderRadius: 12, borderWidth: 1, borderColor: '#6c5ce7', borderStyle: 'dashed' },
  createPostText: { color: '#6c5ce7', fontSize: 15, fontWeight: '600', marginLeft: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 50 },
  emptyText: { color: '#888', fontSize: 16, marginTop: 15 },
  emptySubtext: { color: '#666', fontSize: 14, marginTop: 5 },
  createButton: { backgroundColor: '#6c5ce7', paddingHorizontal: 25, paddingVertical: 12, borderRadius: 25, marginTop: 20 },
  createButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
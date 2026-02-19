import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import EventCard from '../components/EventCard';
import { auth, db } from '../config/firebase';
import { subscribeToEvents } from '../services/eventService';

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

    // Posts listener inline
    let unsubscribePosts = () => {};
    try {
      const q = query(
        collection(db, 'posts'),
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      unsubscribePosts = onSnapshot(q, (snapshot) => {
        const p = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setPosts(p);
      }, (err) => {
        console.error('Posts error:', err);
        setPosts([]);
      });
    } catch (e) {
      console.error('Posts setup error:', e);
    }

    const focusUnsub = navigation.addListener('focus', () => {
      setLoading(true);
      loadUser();
    });

    return () => {
      unsubscribeEvents && unsubscribeEvents();
      unsubscribePosts();
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

  const handleEventPress = (event) => {
    navigation.navigate('EventDetail', { event });
  };

  const handleLogout = () => {
    Alert.alert('Cerrar Sesion', 'Estas seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar Sesion', style: 'destructive', onPress: () => signOut(auth) },
    ]);
  };

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
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('EditProfile')}>
              <Ionicons name="create-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Settings')}>
              <Ionicons name="settings-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.coverContainer}>
          <Image source={{ uri: user?.coverImage || 'https://via.placeholder.com/400x150' }} style={styles.coverImage} />
        </View>

        <View style={styles.profileSection}>
          <Image source={{ uri: user?.avatar || 'https://via.placeholder.com/100' }} style={styles.avatar} />
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
                <Text style={styles.emptyText}>No has creado eventos aun</Text>
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
                <Text style={styles.createPostText}>Crear publicacion</Text>
              </TouchableOpacity>
              {posts.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="chatbubbles-outline" size={50} color="#888" />
                  <Text style={styles.emptyText}>No tienes publicaciones aun</Text>
                </View>
              ) : (
                posts.map(post => (
                  <View key={post.id} style={styles.postCard}>
                    <Text style={styles.postText}>{post.text}</Text>
                  </View>
                ))
              )}
            </>
          )}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ff4444" />
          <Text style={styles.logoutText}>Cerrar Sesion</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  loadingContainer: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 35 : 10, paddingBottom: 15 },
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
  contentSection: { paddingVertical: 15, paddingBottom: 30 },
  createPostButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2d2d44', marginHorizontal: 15, marginBottom: 15, paddingVertical: 15, borderRadius: 12, borderWidth: 1, borderColor: '#6c5ce7', borderStyle: 'dashed' },
  createPostText: { color: '#6c5ce7', fontSize: 15, fontWeight: '600', marginLeft: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 50 },
  emptyText: { color: '#888', fontSize: 16, marginTop: 15 },
  createButton: { backgroundColor: '#6c5ce7', paddingHorizontal: 25, paddingVertical: 12, borderRadius: 25, marginTop: 20 },
  createButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  postCard: { backgroundColor: '#2d2d44', marginHorizontal: 15, marginBottom: 10, padding: 15, borderRadius: 12 },
  postText: { color: '#ddd', fontSize: 15 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 30, paddingVertical: 15, marginHorizontal: 20, backgroundColor: '#2d2d44', borderRadius: 12 },
  logoutText: { color: '#ff4444', fontSize: 16, fontWeight: '600', marginLeft: 10 },
});

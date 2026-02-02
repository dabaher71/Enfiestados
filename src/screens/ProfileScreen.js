import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('eventos');

  const currentUser = auth.currentUser;

  useEffect(() => {
    loadUser();
    const unsubscribeEvents = loadUserEvents();
    // recargar usuario cuando la pantalla recibe foco (vuelve de editar)
    const focusUnsub = navigation.addListener('focus', () => {
      setLoading(true);
      loadUser();
    });
    return () => {
      unsubscribeEvents && unsubscribeEvents();
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

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro que deseas cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Cerrar sesión', 
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
            } catch (error) {
              console.error('Error al cerrar sesión:', error);
            }
          }
        },
      ]
    );
  };

  const handleEventPress = (event) => {
    navigation.navigate('EventDetail', { event });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6c5ce7" />
      </View>
    );
  }

  const attendingEvents = events.filter(event => 
    event.attendees?.includes(currentUser.uid)
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mi Perfil</Text>
          
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Ionicons name="settings-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Cover Image */}
        <View style={styles.coverContainer}>
          <Image
            source={{ uri: user?.coverImage || 'https://via.placeholder.com/400x150' }}
            style={styles.coverImage}
          />
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <Image
            source={{ uri: user?.avatar || 'https://via.placeholder.com/100' }}
            style={styles.avatar}
          />
          
          <Text style={styles.name}>{user?.name || 'Usuario'}</Text>
          <Text style={styles.email}>{currentUser.email}</Text>
          
          {user?.bio ? (
            <Text style={styles.bio}>{user.bio}</Text>
          ) : null}

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{events.length}</Text>
              <Text style={styles.statLabel}>Eventos</Text>
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

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'eventos' && styles.tabActive]}
            onPress={() => setActiveTab('eventos')}
          >
            <Ionicons 
              name="calendar" 
              size={22} 
              color={activeTab === 'eventos' ? '#6c5ce7' : '#888'} 
            />
            <Text style={[styles.tabText, activeTab === 'eventos' && styles.tabTextActive]}>
              Mis eventos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'asistire' && styles.tabActive]}
            onPress={() => setActiveTab('asistire')}
          >
            <Ionicons 
              name="checkmark-circle" 
              size={22} 
              color={activeTab === 'asistire' ? '#6c5ce7' : '#888'} 
            />
            <Text style={[styles.tabText, activeTab === 'asistire' && styles.tabTextActive]}>
              Asistiré
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.eventsSection}>
          {activeTab === 'eventos' ? (
            events.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={50} color="#888" />
                <Text style={styles.emptyText}>No has creado eventos aún</Text>
                <TouchableOpacity
                  style={styles.createEventButton}
                  onPress={() => navigation.navigate('Create')}
                >
                  <Text style={styles.createEventButtonText}>Crear mi primer evento</Text>
                </TouchableOpacity>
              </View>
            ) : (
              events.map(event => (
                <EventCard 
                  key={event.id} 
                  event={event} 
                  onPress={() => handleEventPress(event)} 
                />
              ))
            )
          ) : (
            attendingEvents.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="ticket-outline" size={50} color="#888" />
                <Text style={styles.emptyText}>No tienes eventos confirmados</Text>
              </View>
            ) : (
              attendingEvents.map(event => (
                <EventCard 
                  key={event.id} 
                  event={event} 
                  onPress={() => handleEventPress(event)} 
                />
              ))
            )
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    ppaddingTop: Platform.OS === 'android' ? 35 : 10,
    paddingBottom: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: 15,
  },
  coverContainer: {
    height: 150,
    backgroundColor: '#2d2d44',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: -50,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#1a1a2e',
    backgroundColor: '#2d2d44',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 15,
  },
  email: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  bio: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  editButton: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginTop: 25,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#6c5ce7',
  },
  tabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  tabTextActive: {
    color: '#fff',
  },
  eventsSection: {
    paddingVertical: 20,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    marginTop: 15,
  },
  createEventButton: {
    backgroundColor: '#6c5ce7',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
  },
  createEventButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

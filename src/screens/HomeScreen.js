import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { FeedSkeleton } from '../components/SkeletonLoader';

import { SafeAreaView } from 'react-native-safe-area-context';
import EventCard from '../components/EventCard';
import NativeAdCard from '../components/NativeAdCard';
import { auth, db } from '../config/firebase';
import { subscribeToEvents } from '../services/eventService';
import { registerForPushNotifications } from '../services/pushNotificationService';


// --- Card de publicidad hardcodeada ---
function AdCard({ onPress }) {
  return (
    <TouchableOpacity style={adStyles.card} onPress={onPress}>
      <View style={adStyles.header}>
        <Text style={adStyles.category}>Publicidad</Text>
      </View>
      <View style={adStyles.content}>
        <Text style={adStyles.title}>¡Descubre ofertas especiales!</Text>
        <Text style={adStyles.text}>
          Este espacio es para mostrar anuncios integrados en tu feed.
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const adStyles = StyleSheet.create({
  card: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    marginBottom: 8,
  },
  category: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6c5ce7',
  },
  content: {
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  text: {
    fontSize: 14,
    color: '#ccc',
  },
});

// --- Funciones auxiliares ---
const getEventTimestamp = (ev) => {
  const d = ev?.date || ev?.fecha || ev?.eventDate || ev?.scheduledAt || null;
  if (!d) return 0;
  if (typeof d.toMillis === 'function') return d.toMillis();
  if (typeof d === 'number') return d;
  const parsed = Date.parse(d);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortEventsByClosestToNow = (events = []) => {
  const now = Date.now();
  return events.slice().sort((a, b) => {
    const ta = getEventTimestamp(a);
    const tb = getEventTimestamp(b);
    const da = ta - now;
    const db = tb - now;
    const aFuture = da >= 0;
    const bFuture = db >= 0;
    if (aFuture && !bFuture) return -1;
    if (!aFuture && bFuture) return 1;
    if (aFuture && bFuture) return da - db;
    return Math.abs(da) - Math.abs(db);
  });
};

export default function HomeScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [activeTab, setActiveTab] = useState('parati');
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const userId = auth.currentUser?.uid;
  const orderedEvents = useMemo(() => sortEventsByClosestToNow(events), [events]);
  const [displayedEvents, setDisplayedEvents] = useState([]);

  useEffect(() => {
    loadUserFollowing();

    const unsubscribe = subscribeToEvents((allEvents) => {
      setEvents(allEvents);
      setLoading(false);
    });

    const setupPushNotifications = async () => {
      if (userId) {
        await registerForPushNotifications(userId);
      }
    };
    setupPushNotifications();

    return () => unsubscribe();
  }, []);


  const isEventExpired = (event) => {
    try {
      const [day, month, year] = event.date.split('/');
      const [hours, minutes] = (event.time || '23:59').split(':');
      const eventDate = new Date(year, month - 1, day, hours, minutes);
      return eventDate < new Date();
    } catch (e) { return false; }
  };

  const filterEventsByTab = () => {
    let source = (orderedEvents || []).filter(ev => !isEventExpired(ev));
    if (activeTab === 'following') {
      source = source.filter(ev => following?.includes(ev.organizerId) || false);
    } else if (activeTab === 'recent') {
      source = source.slice();
    }
    setDisplayedEvents(source);
  };

  useEffect(() => {
    filterEventsByTab();
  }, [activeTab, orderedEvents, following]);

  const loadUserFollowing = async () => {
    try {
      if (userId) {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          setFollowing(userDoc.data().following || []);
        }
      }
    } catch (error) {
      console.error('Error cargando following:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserFollowing();
    setRefreshing(false);
  };

  const renderEmptyState = () => {
    let icon = 'sparkles';
    let title = 'No hay eventos';
    let text = 'Aqui apareceran eventos basados en tus intereses';

    if (activeTab === 'siguiendo') {
      icon = 'people';
      title = 'Sin eventos';
      text = following.length === 0 
        ? 'Sigue a usuarios para ver sus eventos aqui' 
        : 'Las personas que sigues no han creado eventos aun';
    } else if (activeTab === 'explorar') {
      icon = 'globe';
      title = 'Sin eventos';
      text = 'Aun no hay eventos disponibles. Se el primero en crear uno!';
    }

    return (
      <View style={styles.emptyState}>
        <Ionicons name={icon} size={60} color="#6c5ce7" />
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyText}>{text}</Text>
        {activeTab === 'siguiendo' && following.length === 0 && (
          <TouchableOpacity 
            style={styles.emptyButton}
            onPress={() => navigation.navigate('Search')}
          >
            <Text style={styles.emptyButtonText}>Explorar usuarios</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const handleEventPress = useCallback((event) => {
    navigation.navigate('EventDetail', { event });
  }, [navigation]);

  const renderItem = useCallback(({ item, index }) => {
    if (index > 0 && (index + 1) % 5 === 0) {
      return (
        <>
          <EventCard event={item} onPress={() => handleEventPress(item)} />
          <NativeAdCard />
        </>
      );
    }
    return <EventCard event={item} onPress={() => handleEventPress(item)} />;
  }, [handleEventPress]);

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.header}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logoImage}
          />
          <Text style={styles.logo}>Enfiestados</Text>
        </View>
        <View style={styles.tabsContainer}>
          <View style={[styles.tab, styles.tabActive]}>
            <Text style={[styles.tabText, styles.tabTextActive]}>Para ti</Text>
          </View>
          <View style={styles.tab}>
            <Ionicons name="people-outline" size={18} color="#888" />
            <Text style={styles.tabText}>Siguiendo</Text>
          </View>
        </View>
        <FeedSkeleton count={3} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.logoImage}
        />
        <Text style={styles.logo}>Enfiestados</Text>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'parati' && styles.tabActive]}
          onPress={() => setActiveTab('parati')}
        >
          <Text style={[styles.tabText, activeTab === 'parati' && styles.tabTextActive]}>
            Para ti
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'siguiendo' && styles.tabActive]}
          onPress={() => setActiveTab('siguiendo')}
        >
          <Ionicons 
            name={activeTab === 'siguiendo' ? 'people' : 'people-outline'} 
            size={18} 
            color={activeTab === 'siguiendo' ? '#fff' : '#888'} 
          />
          <Text style={[styles.tabText, activeTab === 'siguiendo' && styles.tabTextActive]}>
            Siguiendo
          </Text>
        </TouchableOpacity>
      </View>

      {displayedEvents.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={displayedEvents}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={10}
          removeClippedSubviews={true}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingTop: Platform.OS === 'android' ? 8 : 0,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
  },
  logoImage: {
    width: 35,
    height: 35,
    marginRight: 10,
    borderRadius: 8,
  },
    logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 25,
    backgroundColor: '#2d2d44',
    gap: 8,
  },
  tabActive: {
    backgroundColor: '#6c5ce7',
  },
  tabText: {
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingVertical: 10,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 15,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  emptyButton: {
    marginTop: 20,
    backgroundColor: '#6c5ce7',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 25,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});

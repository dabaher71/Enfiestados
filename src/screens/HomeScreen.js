import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { FeedSkeleton } from '../components/SkeletonLoader';

import { SafeAreaView } from 'react-native-safe-area-context';
import EventCard from '../components/EventCard';
import ExternalEventCard from '../components/ExternalEventCard';
import NativeAdCard from '../components/NativeAdCard';
import { auth, db } from '../config/firebase';
import { subscribeToEvents } from '../services/eventService';
import useExternalEvents from '../hooks/useExternalEvents';
import { registerForPushNotifications } from '../services/pushNotificationService';


// --- Funciones auxiliares ---

// Devuelve un timestamp numérico para cualquier tipo de evento.
// Eventos externos: usa dateISO (ISO string correcto).
// Eventos nativos: parsea date como DD/MM/YYYY.
const getEventTimestamp = (ev) => {
  if (ev?._isExternal) {
    if (!ev.dateISO) return Infinity;
    const ts = new Date(ev.dateISO).getTime();
    return isNaN(ts) ? Infinity : ts;
  }
  const d = ev?.date;
  if (!d) return Infinity;
  if (typeof d.toMillis === 'function') return d.toMillis();
  if (typeof d === 'number') return d;
  // Formato DD/MM/YYYY usado por eventos nativos
  const parts = d.split('/');
  if (parts.length === 3) {
    const ts = new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime();
    if (!isNaN(ts)) return ts;
  }
  const parsed = Date.parse(d);
  return isNaN(parsed) ? Infinity : parsed;
};

// Ordena ascendente: fecha más próxima primero, más lejana al final.
// Eventos sin fecha reconocible van al fondo (Infinity).
const sortByDateAsc = (events = []) =>
  events.slice().sort((a, b) => getEventTimestamp(a) - getEventTimestamp(b));

export default function HomeScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [activeTab, setActiveTab] = useState('parati');
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const userId = auth.currentUser?.uid;
  const { data: externalEvents } = useExternalEvents();

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

  const displayedEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const native = events.filter(ev => !isEventExpired(ev));

    if (activeTab === 'siguiendo') {
      return sortByDateAsc(
        native.filter(ev => following?.includes(ev.organizerId) || false)
      );
    }

    // "parati": nativos + externos futuros, todos ordenados por fecha
    const validExternal = externalEvents.filter(e => {
      if (e.dateISO) return new Date(e.dateISO) >= today;
      return true;
    });
    return sortByDateAsc([...native, ...validExternal]);
  }, [activeTab, events, following, externalEvents]);

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

  // Dispatcher pattern: referencia estable — EventCard no re-renderiza por este prop
  const dispatch = useCallback(({ type, payload }) => {
    if (type === 'PRESS') navigation.navigate('EventDetail', { event: payload });
  }, [navigation]);

  // Feed con ads intercalados cada 2 eventos
  const feedWithAds = useMemo(() => {
    const result = [];
    displayedEvents.forEach((event, index) => {
      result.push(event);
      if ((index + 1) % 2 === 0) {
        result.push({ _isAd: true, id: `ad_${index}` });
      }
    });
    return result;
  }, [displayedEvents]);

  const renderItem = useCallback(({ item }) => {
    if (item._isAd) {
      return <NativeAdCard />;
    }
    if (item._isExternal) {
      return <ExternalEventCard event={item} style={styles.externalCardFeed} />;
    }
    return <EventCard event={item} dispatch={dispatch} />;
  }, [dispatch]);

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
        <FlashList
          data={feedWithAds}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          estimatedItemSize={280}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
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
  externalCardFeed: {
    width: 'auto',
    marginHorizontal: 20,
    marginVertical: 6,
    marginRight: 20,
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

import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import InternalAdCard from '../components/InternalAdCard';
import NativeAdCard from '../components/NativeAdCard';
import { auth, db, functions } from '../config/firebase';
import { httpsCallable } from 'firebase/functions';
import { fetchMoreEvents, subscribeToEvents } from '../services/eventService';
import useExternalEvents from '../hooks/useExternalEvents';
import { registerForPushNotifications } from '../services/pushNotificationService';
import { recordSignal, getHiddenEventIds } from '../services/signalService';
import { scoreAndRankEvents } from '../services/feedService';
import { fetchActiveAds } from '../services/adService';


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
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [interestVector, setInterestVector] = useState({});
  const [userInterests, setUserInterests] = useState([]);
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [internalAds, setInternalAds] = useState([]);
  const adIndexRef = useRef(0);
  const userId = auth.currentUser?.uid;
  const { data: externalEvents } = useExternalEvents();

  // Mapa de eventId → timestamp de cuando el card se hizo visible
  const visibleSinceRef = useRef({});

  useEffect(() => {
    loadUserFollowing();
    loadUserProfile();

    const unsubscribe = subscribeToEvents((firstPageEvents, cursor) => {
      setEvents(firstPageEvents);
      setLastDoc(cursor);
      setHasMore(firstPageEvents.length === 20);
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

  const loadUserProfile = async () => {
    if (!userId) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setInterestVector(data.interestVector || {});
        const interests = data.interests || [];
        setUserInterests(interests);
        const ads = await fetchActiveAds({ province: data.location, interests });
        setInternalAds(ads);
        adIndexRef.current = 0;
      }
      const hidden = await getHiddenEventIds(userId);
      setHiddenIds(hidden);
    } catch {
      // non-critical
    }
  };


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

    // "parati": nativos + externos futuros, ordenados por score personalizado
    const validExternal = externalEvents.filter(e => {
      if (e.dateISO) return new Date(e.dateISO) >= today;
      return true;
    });
    return scoreAndRankEvents([...native, ...validExternal], interestVector, hiddenIds, userInterests);
  }, [activeTab, events, following, externalEvents, interestVector, hiddenIds, userInterests]);

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
    // Solicitar regeneración del feed personalizado en servidor
    try {
      const refreshMyFeed = httpsCallable(functions, 'refreshMyFeed');
      await refreshMyFeed();
      await loadUserProfile(); // recargar interestVector + hiddenIds actualizados
    } catch {
      // si falla la Cloud Function, el scoring local ya funciona como fallback
    }
    setRefreshing(false);
  };

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !lastDoc) return;
    setLoadingMore(true);
    try {
      const { events: moreEvents, lastDoc: newLastDoc, hasMore: more } = await fetchMoreEvents(lastDoc);
      setEvents(prev => {
        const existingIds = new Set(prev.map(e => e.id));
        const newEvents = moreEvents.filter(e => !existingIds.has(e.id));
        return [...prev, ...newEvents];
      });
      setLastDoc(newLastDoc);
      setHasMore(more);
    } catch (e) {
      console.error('Error cargando más eventos:', e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, lastDoc]);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#6c5ce7" />
      </View>
    );
  }, [loadingMore]);

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

  // Tracking de tiempo de vista — cuando un card sale del viewport registra la señal
  const onViewableItemsChanged = useCallback(({ changed }) => {
    if (!userId) return;
    const now = Date.now();
    changed.forEach(({ item, isViewable }) => {
      if (item._isAd || item._isInternalAd || item._isExternal) return;
      if (isViewable) {
        visibleSinceRef.current[item.id] = now;
      } else {
        const since = visibleSinceRef.current[item.id];
        if (since) {
          const durationMs = now - since;
          delete visibleSinceRef.current[item.id];
          // >3s = longView (señal fuerte), <3s = view (señal débil)
          recordSignal(userId, item, durationMs >= 3000 ? 'longView' : 'view');
        }
      }
    });
  }, [userId]);

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 });

  const handleHide = useCallback((eventId) => {
    setHiddenIds(prev => new Set([...prev, eventId]));
  }, []);

  // Feed con ads cada 4 eventos: ads internos primero, AdMob como fallback
  const feedWithAds = useMemo(() => {
    const result = [];
    let adSlot = 0;
    displayedEvents.forEach((event, index) => {
      result.push(event);
      if ((index + 1) % 4 === 0) {
        if (internalAds.length > 0) {
          const ad = internalAds[adSlot % internalAds.length];
          result.push({ _isInternalAd: true, ad, id: `iad_${adSlot}` });
          adSlot++;
        } else {
          result.push({ _isAd: true, id: `ad_${index}` });
        }
      }
    });
    return result;
  }, [displayedEvents, internalAds]);

  const handleAdEventPress = useCallback((eventId) => {
    navigation.navigate('EventDetail', { eventId });
  }, [navigation]);

  const renderItem = useCallback(({ item }) => {
    if (item._isInternalAd) {
      return <InternalAdCard ad={item.ad} onEventPress={handleAdEventPress} />;
    }
    if (item._isAd) {
      return <NativeAdCard />;
    }
    if (item._isExternal) {
      return <ExternalEventCard event={item} />;
    }
    return <EventCard event={item} dispatch={dispatch} userId={userId} onHide={handleHide} />;
  }, [dispatch, userId, handleHide, handleAdEventPress]);

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
          estimatedItemSize={430}
          getItemType={(item) => {
            if (item._isInternalAd) return 'internalAd';
            if (item._isAd) return 'ad';
            if (item._isExternal) return 'external';
            return 'event';
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={renderFooter}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig.current}
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
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

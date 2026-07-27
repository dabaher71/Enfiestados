// HomeScreen — feed "Para vos" / "Siguiendo" con agenda por día, scroll infinito.
// FIX_ROUND_1: separadores correctos, header con chips, overline correcto, badges,
//              fin de feed, sin hueco vacío en ads, SkeletonList desde frame 0.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';

import InternalAdCard from '../components/InternalAdCard';
import NativeAdCard from '../components/NativeAdCard';
import EmptyState from '../components/ui/EmptyState';
import EventCardHero from '../components/ui/EventCardHero';
import EventRow from '../components/ui/EventRow';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import Skeleton, { SkeletonEventRow, SkeletonList } from '../components/ui/Skeleton';
import Text from '../components/ui/Text';
import Button from '../components/ui/Button';

import { auth, db, functions } from '../config/firebase';
import useExternalEvents from '../hooks/useExternalEvents';
import { formatDaySeparator } from '../lib/format';
import { fetchActiveAds } from '../services/adService';
import { fetchMoreEvents, subscribeToEvents } from '../services/eventService';
import { registerForPushNotifications } from '../services/pushNotificationService';
import { getHiddenEventIds, recordSignal } from '../services/signalService';
import { scoreAndRankEvents } from '../services/feedService';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import t from '../i18n/es-CR.json';

// ─── Helpers de fecha/timestamp ───────────────────────────────────────────────

const getEventTimestamp = (ev) => {
  if (ev?._isExternal) {
    const ts = ev.dateISO ? new Date(ev.dateISO).getTime() : Infinity;
    return isNaN(ts) ? Infinity : ts;
  }
  const d = ev?.date;
  if (!d) return Infinity;
  if (typeof d.toMillis === 'function') return d.toMillis();
  if (typeof d === 'number') return d;
  const parts = d.split('/');
  if (parts.length === 3) {
    const ts = new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime();
    if (!isNaN(ts)) return ts;
  }
  const p = Date.parse(d);
  return isNaN(p) ? Infinity : p;
};

const sortByDateAsc = (events = []) =>
  events.slice().sort((a, b) => getEventTimestamp(a) - getEventTimestamp(b));

const getDateKey = (event) => {
  const ts = getEventTimestamp(event);
  if (ts === Infinity) return null;
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

// Construye el array del feed con separadores de día y ads.
// Devuelve también stickyHeaderIndices para que FlashList ancle los separadores.
function buildFeedData(events, internalAds) {
  const data = [];
  const stickyIndices = [];
  let lastKey = null;
  let adSlot = 0;
  let eventCount = 0;

  // Agrupa eventos por día para el contador del separador
  const countByKey = {};
  events.forEach(ev => {
    const k = getDateKey(ev);
    if (k) countByKey[k] = (countByKey[k] || 0) + 1;
  });

  events.forEach((event) => {
    const key = getDateKey(event);
    if (key && key !== lastKey) {
      stickyIndices.push(data.length);
      data.push({
        _isSeparator: true,
        date: event.date ?? event.dateISO,
        count: countByKey[key] ?? 0,
        id: `sep_${key}`,
      });
      lastKey = key;
    }
    data.push(event);
    eventCount++;

    // Ad cada 6 eventos, nunca antes del 4º (ratio 1:6)
    if (eventCount >= 4 && eventCount % 6 === 0) {
      if (internalAds.length > 0) {
        const ad = internalAds[adSlot % internalAds.length];
        data.push({ _isInternalAd: true, ad, id: `iad_${adSlot}` });
        adSlot++;
      } else {
        data.push({ _isAd: true, id: `ad_${eventCount}` });
      }
    }
  });
  return { data, stickyIndices };
}

// ─── Filtros de tiempo ────────────────────────────────────────────────────────

const TIME_FILTERS = [
  { label: t.home.filters.today,   value: 'today' },
  { label: t.home.filters.weekend, value: 'weekend' },
  { label: t.home.filters.free,    value: 'free' },
];

function applyTimeFilter(events, filter) {
  if (!filter) return events;
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const friday = new Date(today); friday.setDate(today.getDate() + ((5 - today.getDay() + 7) % 7));
  const sunday = new Date(friday); sunday.setDate(friday.getDate() + 2); sunday.setHours(23, 59, 59);

  return events.filter(ev => {
    if (filter === 'free') return ev.isFree === true || ev.price === 0;
    const ts = getEventTimestamp(ev);
    if (ts === Infinity) return false;
    const d = new Date(ts);
    if (filter === 'today') return d >= today && d < new Date(today.getTime() + 86400000);
    if (filter === 'weekend') return d >= friday && d <= sunday;
    return true;
  });
}

// ─── Separador de día (sticky) ────────────────────────────────────────────────

function DaySeparator({ date, count, colors }) {
  const { label, isToday } = formatDaySeparator(date);
  const labelColor = isToday ? colors['action.primary'] : colors['text.secondary'];
  return (
    <View style={[styles.daySep, { backgroundColor: colors['bg.base'] }]}>
      <Text
        style={[styles.daySepLabel, { color: labelColor, fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, letterSpacing: 1.2 }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View style={[styles.daySepLine, { backgroundColor: colors['border.subtle'] }]} />
      {count > 0 && (
        <Text variant="caption" color="text.tertiary" style={styles.daySepCount}>
          {count} {count === 1 ? 'plan' : 'planes'}
        </Text>
      )}
    </View>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const [events,        setEvents]        = useState([]);
  const [activeTab,     setActiveTab]     = useState('parati');
  const [timeFilter,    setTimeFilter]    = useState(null);
  const [following,     setFollowing]     = useState([]);
  const [userLocation,  setUserLocation]  = useState('');
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(false);
  const [refreshing,    setRefreshing]    = useState(false);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [lastDoc,       setLastDoc]       = useState(null);
  const [hasMore,       setHasMore]       = useState(true);
  const [interestVector,setInterestVector]= useState({});
  const [userInterests, setUserInterests] = useState([]);
  const [hiddenIds,     setHiddenIds]     = useState(new Set());
  const [internalAds,   setInternalAds]   = useState([]);
  const [unreadMessages,setUnreadMessages]= useState(0);

  const visibleSinceRef  = useRef({});
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 });
  const userId = auth.currentUser?.uid;
  const { data: externalEvents } = useExternalEvents();

  // ── Carga ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadUserFollowing();
    loadUserProfile();
    const unsub = subscribeToEvents(
      (firstPage, cursor) => {
        setEvents(firstPage);
        setLastDoc(cursor);
        setHasMore(firstPage.length === 20);
        setLoading(false);
        setError(false);
      },
      () => { setLoading(false); setError(true); }
    );
    if (userId) registerForPushNotifications(userId).catch(() => {});
    return () => unsub();
  }, []);

  const loadUserProfile = async () => {
    if (!userId) return;
    try {
      const snap = await getDoc(doc(db, 'users', userId));
      if (snap.exists()) {
        const data = snap.data();
        setInterestVector(data.interestVector || {});
        setUserInterests(data.interests || []);
        setUserLocation(data.location || '');
        const ads = await fetchActiveAds({ province: data.location, interests: data.interests });
        setInternalAds(ads);
      }
      const hidden = await getHiddenEventIds(userId);
      setHiddenIds(hidden);
    } catch {}
  };

  const loadUserFollowing = async () => {
    if (!userId) return;
    try {
      const snap = await getDoc(doc(db, 'users', userId));
      if (snap.exists()) setFollowing(snap.data().following || []);
    } catch {}
  };

  // ── Feed ───────────────────────────────────────────────────────────────────

  const isExpired = useCallback((ev) => {
    try {
      const [day, month, year] = ev.date.split('/');
      const [h, m] = (ev.time || '23:59').split(':');
      return new Date(year, month - 1, day, h, m) < new Date();
    } catch { return false; }
  }, []);

  const displayedEvents = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const native = events.filter(ev => !isExpired(ev));
    let base;
    if (activeTab === 'siguiendo') {
      base = sortByDateAsc(native.filter(ev => following?.includes(ev.organizerId)));
    } else {
      const validExternal = externalEvents.filter(e => e.dateISO ? new Date(e.dateISO) >= today : true);
      base = scoreAndRankEvents([...native, ...validExternal], interestVector, hiddenIds, userInterests);
    }
    return applyTimeFilter(base, timeFilter);
  }, [activeTab, events, following, externalEvents, interestVector, hiddenIds, userInterests, timeFilter, isExpired]);

  const { data: feedData, stickyIndices } = useMemo(
    () => buildFeedData(displayedEvents, internalAds),
    [displayedEvents, internalAds]
  );

  // ── Interacciones ──────────────────────────────────────────────────────────

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserFollowing();
    try {
      await httpsCallable(functions, 'refreshMyFeed')();
      await loadUserProfile();
    } catch {}
    setRefreshing(false);
  };

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !lastDoc) return;
    setLoadingMore(true);
    try {
      const { events: more, lastDoc: newCursor, hasMore: moreAvail } = await fetchMoreEvents(lastDoc);
      setEvents(prev => {
        const ids = new Set(prev.map(e => e.id));
        return [...prev, ...more.filter(e => !ids.has(e.id))];
      });
      setLastDoc(newCursor);
      setHasMore(moreAvail);
    } catch {}
    setLoadingMore(false);
  }, [loadingMore, hasMore, lastDoc]);

  const onViewableItemsChanged = useCallback(({ changed }) => {
    if (!userId) return;
    const now = Date.now();
    changed.forEach(({ item, isViewable }) => {
      if (item._isAd || item._isInternalAd || item._isSeparator) return;
      if (isViewable) {
        visibleSinceRef.current[item.id] = now;
      } else {
        const since = visibleSinceRef.current[item.id];
        if (since) {
          const ms = now - since;
          delete visibleSinceRef.current[item.id];
          recordSignal(userId, item, ms >= 3000 ? 'longView' : 'view');
        }
      }
    });
  }, [userId]);

  // ── Renders ────────────────────────────────────────────────────────────────

  // Primer evento nativo con imagen → hero. Resto → row.
  const firstEventId = useMemo(() => {
    const first = displayedEvents.find(e => !e._isExternal && e.imageUrl);
    return first?.id ?? null;
  }, [displayedEvents]);

  const renderItem = useCallback(({ item }) => {
    if (item._isSeparator) {
      return <DaySeparator date={item.date} count={item.count} colors={colors} />;
    }
    if (item._isInternalAd) {
      return <InternalAdCard ad={item.ad} onEventPress={id => navigation.navigate('EventDetail', { eventId: id })} />;
    }
    if (item._isAd) return <NativeAdCard />;

    if (item.id === firstEventId) {
      return (
        <EventCardHero
          event={item}
          onPress={() => navigation.navigate('EventDetail', { event: item })}
          style={styles.heroCard}
        />
      );
    }
    return (
      <EventRow
        event={item}
        trailing="auto"
        onPress={() => navigation.navigate('EventDetail', { event: item })}
      />
    );
  }, [navigation, colors, firstEventId]);

  const getItemType = useCallback((item) => {
    if (item._isSeparator)  return 'separator';
    if (item._isInternalAd) return 'internalAd';
    if (item._isAd)         return 'ad';
    return 'event';
  }, []);

  // Footer: skeleton mientras carga más, mensaje de fin cuando no hay más
  const ListFooter = useCallback(() => {
    if (loadingMore) return <SkeletonList count={2} />;
    if (!hasMore && displayedEvents.length > 0) {
      return (
        <View style={[styles.endOfFeed, { borderTopColor: colors['border.subtle'] }]}>
          <Text variant="caption" color="text.tertiary" align="center">
            No hay más eventos esta semana
          </Text>
          <Button
            variant="ghost"
            size="sm"
            label="Ver la próxima semana"
            onPress={() => {/* TODO: ampliar rango */}}
          />
        </View>
      );
    }
    return null;
  }, [loadingMore, hasMore, displayedEvents.length, colors]);

  // ── Layout ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
        <HomeHeader colors={colors} navigation={navigation} unread={unreadMessages} userLocation={userLocation} />
        <HomeTabs activeTab={activeTab} onSelect={setActiveTab} />
        <HomeTimeFilters active={timeFilter} onSelect={f => setTimeFilter(prev => prev === f ? null : f)} />
        <SkeletonList count={5} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
        <HomeHeader colors={colors} navigation={navigation} unread={unreadMessages} userLocation={userLocation} />
        <EmptyState
          icon={<Ionicons name="cloud-offline-outline" size={28} color={colors['text.tertiary']} />}
          title={t.home.error.title}
          actionLabel={t.home.error.action}
          onAction={() => { setError(false); setLoading(true); loadUserProfile(); }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      <HomeHeader colors={colors} navigation={navigation} unread={unreadMessages} userLocation={userLocation} />
      <HomeTabs activeTab={activeTab} onSelect={setActiveTab} />
      <HomeTimeFilters active={timeFilter} onSelect={f => setTimeFilter(prev => prev === f ? null : f)} />

      {displayedEvents.length === 0 ? (
        <EmptyState
          icon={<Ionicons name={activeTab === 'siguiendo' ? 'people-outline' : 'sparkles-outline'} size={28} color={colors['text.tertiary']} />}
          title={activeTab === 'siguiendo' ? t.home.empty.following.title : t.home.empty.forYou.title}
          description={activeTab === 'siguiendo' ? t.home.empty.following.desc : t.home.empty.forYou.desc}
          actionLabel={activeTab === 'siguiendo' ? t.home.empty.following.action : t.home.empty.forYou.action}
          onAction={() => activeTab === 'siguiendo' ? navigation.navigate('Explore') : navigation.navigate('Interests')}
        />
      ) : (
        <FlashList
          data={feedData}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          estimatedItemSize={96}
          getItemType={getItemType}
          stickyHeaderIndices={stickyIndices}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={<ListFooter />}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig.current}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function HomeHeader({ colors, navigation, unread, userLocation }) {
  return (
    <View style={styles.header}>
      <Image source={require('../../assets/images/logo.png')} style={styles.logo} contentFit="cover" />
      <Text style={{ fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 17, color: colors['text.primary'], flex: 1 }}>
        Enfiestados
      </Text>

      {/* Chip de ubicación */}
      {userLocation ? (
        <Pressable
          style={[styles.locationChip, { borderColor: colors['border.strong'] }]}
          onPress={() => {/* TODO: cambiar ubicación */}}
          accessibilityRole="button"
          accessibilityLabel={`Ubicación: ${userLocation}`}
        >
          <Ionicons name="location-outline" size={14} color={colors['text.secondary']} />
          <Text style={{ fontSize: 13.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors['text.secondary'] }}>
            {userLocation}
          </Text>
          <Ionicons name="chevron-down" size={12} color={colors['text.tertiary']} />
        </Pressable>
      ) : null}

      {/* Mensajes */}
      <Pressable
        onPress={() => navigation.navigate('Messages')}
        style={styles.headerIcon}
        accessibilityLabel="Mensajes"
        accessibilityRole="button"
      >
        <Ionicons name="chatbubble-outline" size={22} color={colors['text.primary']} />
        {unread > 0 && (
          <View style={[styles.headerBadge, { backgroundColor: colors['status.urgent'], borderColor: colors['bg.base'] }]} />
        )}
      </Pressable>

      {/* Chip amarillo "Crear" */}
      <Pressable
        onPress={() => navigation.navigate('CreateEvent')}
        style={[styles.createChip, { backgroundColor: colors['action.primary'] }]}
        accessibilityLabel="Crear evento"
        accessibilityRole="button"
      >
        <Ionicons name="add" size={16} color={colors['text.onAction']} />
        <Text style={{ fontSize: 13.5, fontFamily: 'PlusJakartaSans_700Bold', color: colors['text.onAction'] }}>
          Crear
        </Text>
      </Pressable>
    </View>
  );
}

function HomeTabs({ activeTab, onSelect }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tabsRow, { borderBottomColor: colors['border.subtle'] }]}>
      <SegmentedControl
        options={[
          { label: t.home.tabs.forYou,    value: 'parati' },
          { label: t.home.tabs.following, value: 'siguiendo' },
        ]}
        selected={activeTab}
        onSelect={onSelect}
      />
    </View>
  );
}

function HomeTimeFilters({ active, onSelect }) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipsRow}
    >
      {TIME_FILTERS.map(f => (
        <Pressable
          key={f.value}
          onPress={() => onSelect(f.value)}
          style={[
            styles.chip,
            {
              backgroundColor: active === f.value ? colors['action.primary'] : colors['bg.surface'],
              borderColor:     active === f.value ? colors['action.primary'] : colors['border.strong'],
            },
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: active === f.value }}
        >
          <Text variant="label" style={{ color: active === f.value ? colors['text.onAction'] : colors['text.secondary'] }}>
            {f.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { paddingBottom: space[12] },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    gap: space[2],
    minHeight: 56,
  },
  logo: { width: 32, height: 32, borderRadius: 8 },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    borderWidth: 1.5,
    gap: space[1],
  },
  headerIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerBadge: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  createChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    gap: 4,
  },

  tabsRow: {
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  chipsRow: {
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    gap: space[2],
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.md,
    borderWidth: 1.5,
  },

  // Separador de día
  daySep: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingTop: space[2],
    paddingBottom: space[2] + 2,
    gap: space[3],
  },
  daySepLabel: { flexShrink: 0 },
  daySepLine:  { flex: 1, height: 1 },
  daySepCount: { flexShrink: 0 },

  heroCard: { marginBottom: space[3] },

  endOfFeed: {
    alignItems: 'center',
    paddingVertical: space[8],
    marginHorizontal: space[5],
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space[2],
  },
});

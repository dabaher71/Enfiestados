// HomeScreen — feed "Para vos" / "Siguiendo" con agenda por día, scroll infinito.
// LÓGICA INTACTA: feed personalizado, señales, paginación, ads, push notifications.
// PRESENTACIÓN: design system v1.1 — tokens, EventRow, EmptyState, SkeletonList.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';

import InternalAdCard from '../components/InternalAdCard';
import NativeAdCard from '../components/NativeAdCard';
import EmptyState from '../components/ui/EmptyState';
import { EventCardHero } from '../components/ui/EventCardHero';
import EventRow from '../components/ui/EventRow';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { SkeletonList } from '../components/ui/Skeleton';
import Text from '../components/ui/Text';

import { auth, db, functions } from '../config/firebase';
import useExternalEvents from '../hooks/useExternalEvents';
import { formatEventDate, formatRelative } from '../lib/format';
import { fetchActiveAds } from '../services/adService';
import { fetchMoreEvents, subscribeToEvents } from '../services/eventService';
import { registerForPushNotifications } from '../services/pushNotificationService';
import { getHiddenEventIds, recordSignal } from '../services/signalService';
import { scoreAndRankEvents } from '../services/feedService';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import t from '../i18n/es-CR.json';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  const parts = d.split('/');
  if (parts.length === 3) {
    const ts = new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime();
    if (!isNaN(ts)) return ts;
  }
  const parsed = Date.parse(d);
  return isNaN(parsed) ? Infinity : parsed;
};

const sortByDateAsc = (events = []) =>
  events.slice().sort((a, b) => getEventTimestamp(a) - getEventTimestamp(b));

const getDateKey = (event) => {
  const ts = getEventTimestamp(event);
  if (ts === Infinity) return null;
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

// Inyecta separadores de fecha + ads (ratio 1:6, nunca antes del 4º ítem)
function buildFeedData(events, internalAds) {
  const withSeps = [];
  let lastKey = null;
  let adSlot = 0;
  let eventCount = 0;

  events.forEach((event) => {
    const key = getDateKey(event);
    if (key && key !== lastKey) {
      withSeps.push({ _isSeparator: true, date: event.date ?? event.dateISO, id: `sep_${key}` });
      lastKey = key;
    }
    withSeps.push(event);
    eventCount++;

    // Ad cada 6 eventos, nunca antes del 4º
    if (eventCount >= 4 && eventCount % 6 === 0) {
      if (internalAds.length > 0) {
        const ad = internalAds[adSlot % internalAds.length];
        withSeps.push({ _isInternalAd: true, ad, id: `iad_${adSlot}` });
        adSlot++;
      } else {
        withSeps.push({ _isAd: true, id: `ad_${eventCount}` });
      }
    }
  });
  return withSeps;
}

// ─── Filtros rápidos ──────────────────────────────────────────────────────────

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
    if (filter === 'free') return ev.isFree || ev.price === 0;
    const ts = getEventTimestamp(ev);
    if (ts === Infinity) return false;
    const d = new Date(ts);
    if (filter === 'today') return d >= today && d < new Date(today.getTime() + 86400000);
    if (filter === 'weekend') return d >= friday && d <= sunday;
    return true;
  });
}

// ─── Componente de separador de fecha ────────────────────────────────────────

function DateSeparator({ date }) {
  const { colors } = useTheme();
  const label = formatRelative(date) ?? formatEventDate(date);
  return (
    <View style={[styles.separator, { borderBottomColor: colors['border.subtle'] }]}>
      <Text variant="overline" color="text.tertiary">{label.toUpperCase()}</Text>
    </View>
  );
}

// ─── Componente de unread messages en header ──────────────────────────────────

function MessagesButton({ onPress, unread }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={styles.headerIcon}
      accessibilityLabel={t.home.messages}
      accessibilityRole="button"
    >
      <Ionicons name="chatbubble-outline" size={24} color={colors['text.primary']} />
      {unread > 0 && (
        <View style={[styles.headerBadge, { backgroundColor: colors['status.urgent'], borderColor: colors['bg.base'] }]} />
      )}
    </Pressable>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const [events, setEvents] = useState([]);
  const [activeTab, setActiveTab] = useState('parati');
  const [timeFilter, setTimeFilter] = useState(null);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [interestVector, setInterestVector] = useState({});
  const [userInterests, setUserInterests] = useState([]);
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [internalAds, setInternalAds] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const adIndexRef = useRef(0);
  const visibleSinceRef = useRef({});
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 });
  const userId = auth.currentUser?.uid;
  const { data: externalEvents } = useExternalEvents();

  // ── Carga inicial ──────────────────────────────────────────────────────────

  useEffect(() => {
    loadUserFollowing();
    loadUserProfile();

    const unsub = subscribeToEvents((firstPage, cursor) => {
      setEvents(firstPage);
      setLastDoc(cursor);
      setHasMore(firstPage.length === 20);
      setLoading(false);
      setError(false);
    }, () => {
      setLoading(false);
      setError(true);
    });

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
        const ads = await fetchActiveAds({ province: data.location, interests: data.interests });
        setInternalAds(ads);
        adIndexRef.current = 0;
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

  // ── Feed computado ─────────────────────────────────────────────────────────

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
      const validExternal = externalEvents.filter(e =>
        e.dateISO ? new Date(e.dateISO) >= today : true
      );
      base = scoreAndRankEvents([...native, ...validExternal], interestVector, hiddenIds, userInterests);
    }
    return applyTimeFilter(base, timeFilter);
  }, [activeTab, events, following, externalEvents, interestVector, hiddenIds, userInterests, timeFilter, isExpired]);

  const feedData = useMemo(
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

  const handleHide = useCallback((eventId) => {
    setHiddenIds(prev => new Set([...prev, eventId]));
  }, []);

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

  // ── Render items ───────────────────────────────────────────────────────────

  const renderItem = useCallback(({ item, index }) => {
    if (item._isSeparator) return <DateSeparator date={item.date} />;
    if (item._isInternalAd)  return <InternalAdCard ad={item.ad} onEventPress={id => navigation.navigate('EventDetail', { eventId: id })} />;
    if (item._isAd)          return <NativeAdCard />;

    // Primeros 2 eventos nativos con imagen como hero cards
    const isHero = index < 3 && !item._isExternal && item.imageUrl;
    if (isHero) {
      return (
        <EventCardHero
          event={item}
          onPress={() => navigation.navigate('EventDetail', { event: item })}
          onSave={() => recordSignal(userId, item, 'attend')}
          style={styles.heroCard}
        />
      );
    }

    return (
      <EventRow
        event={item}
        trailing="price"
        onPress={() => navigation.navigate('EventDetail', { event: item })}
      />
    );
  }, [navigation, userId]);

  const getItemType = useCallback((item) => {
    if (item._isSeparator)  return 'separator';
    if (item._isInternalAd) return 'internalAd';
    if (item._isAd)         return 'ad';
    return 'event';
  }, []);

  // ── Estados ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
        <Header colors={colors} navigation={navigation} unread={unreadMessages} />
        <Tabs activeTab={activeTab} onSelect={setActiveTab} colors={colors} />
        <SkeletonList count={5} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
        <Header colors={colors} navigation={navigation} unread={unreadMessages} />
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
      <Header colors={colors} navigation={navigation} unread={unreadMessages} />
      <Tabs activeTab={activeTab} onSelect={setActiveTab} colors={colors} />
      <TimeFilters active={timeFilter} onSelect={f => setTimeFilter(prev => prev === f ? null : f)} colors={colors} />

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
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <SkeletonList count={2} /> : null}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig.current}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Sub-componentes de layout ────────────────────────────────────────────────

function Header({ colors, navigation, unread }) {
  return (
    <View style={styles.header}>
      <Image
        source={require('../../assets/images/logo.png')}
        style={styles.logo}
        contentFit="cover"
      />
      <Text variant="h2" style={styles.brandName}>Enfiestados</Text>
      <View style={styles.headerActions}>
        <MessagesButton onPress={() => navigation.navigate('Messages')} unread={unread} />
        <Pressable
          onPress={() => navigation.navigate('CreateEvent')}
          style={styles.headerIcon}
          accessibilityLabel={t.home.createEvent}
          accessibilityRole="button"
        >
          <Ionicons name="add-circle-outline" size={26} color={colors['action.primary']} />
        </Pressable>
      </View>
    </View>
  );
}

function Tabs({ activeTab, onSelect, colors }) {
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

function TimeFilters({ active, onSelect, colors }) {
  return (
    <View style={styles.chipsRow}>
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
          <Text
            variant="label"
            style={{ color: active === f.value ? colors['text.onAction'] : colors['text.secondary'] }}
          >
            {f.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  list:   { paddingBottom: space[12] },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    height: 60,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    marginRight: space[2],
  },
  brandName: { flex: 1 },
  headerActions: { flexDirection: 'row', gap: space[1] },
  headerIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
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

  tabsRow: {
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  chipsRow: {
    flexDirection: 'row',
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    gap: space[2],
  },
  chip: {
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: 12,
    borderWidth: 1.5,
  },

  separator: {
    paddingHorizontal: space[5],
    paddingVertical: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  heroCard: { marginBottom: space[6] },
});

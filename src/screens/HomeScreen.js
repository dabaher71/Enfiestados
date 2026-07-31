// HomeScreen — reconstrucción según FIX_ROUND_2 § 3
// SectionList con sticky headers por día, fila de chips correcta, badge correcto.
// Lógica de datos/hooks intacta.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable, RefreshControl, SectionList,
  ScrollView, StyleSheet, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import InternalAdCard from '../components/InternalAdCard';
import NativeAdCard from '../components/NativeAdCard';
import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import EmptyState from '../components/ui/EmptyState';
import EventRow from '../components/ui/EventRow';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { SkeletonEventRow, SkeletonList } from '../components/ui/Skeleton';
import Text from '../components/ui/Text';

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTs(ev) {
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
}

function sortAsc(events) {
  return events.slice().sort((a, b) => getTs(a) - getTs(b));
}

function getDateKey(ev) {
  const ts = getTs(ev);
  if (ts === Infinity) return 'sin-fecha';
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Agrupa eventos por día para SectionList. Ads intercalados cada 6 eventos.
function groupByDay(events, internalAds) {
  const map = new Map();
  const order = [];
  let eventCount = 0;
  let adSlot = 0;

  events.forEach(ev => {
    const key = getDateKey(ev);
    if (!map.has(key)) {
      const { label, isToday } = formatDaySeparator(ev.date ?? ev.dateISO);
      map.set(key, { key, label, isToday, data: [] });
      order.push(key);
    }
    map.get(key).data.push(ev);
    eventCount++;

    // Ad cada 6 eventos, nunca antes del 4º
    if (eventCount >= 4 && eventCount % 6 === 0) {
      const adItem = internalAds.length > 0
        ? { _isInternalAd: true, ad: internalAds[adSlot++ % internalAds.length], id: `iad_${adSlot}` }
        : { _isAd: true, id: `ad_${eventCount}` };
      map.get(key).data.push(adItem);
    }
  });

  return order.map(k => map.get(k));
}

function applyTimeFilter(events, filter) {
  if (!filter) return events;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const friday = new Date(today); friday.setDate(today.getDate() + ((5 - today.getDay() + 7) % 7));
  const sunday = new Date(friday); sunday.setDate(friday.getDate() + 2); sunday.setHours(23, 59, 59);

  return events.filter(ev => {
    if (filter === 'free') return ev.isFree === true || ev.price === 0;
    const ts = getTs(ev);
    if (ts === Infinity) return false;
    const d = new Date(ts);
    if (filter === 'today')   return d >= today && d < new Date(today.getTime() + 86400000);
    if (filter === 'weekend') return d >= friday && d <= sunday;
    return true;
  });
}

const TABS = [
  { label: t.home.tabs.forYou,    value: 'parati' },
  { label: t.home.tabs.following, value: 'siguiendo' },
];

const FILTERS = [
  { label: t.home.filters.today,   value: 'today' },
  { label: t.home.filters.weekend, value: 'weekend' },
  { label: t.home.filters.free,    value: 'free' },
];

// ─── DaySeparator — sticky, fondo opaco ──────────────────────────────────────

function DaySeparator({ section }) {
  const { colors } = useTheme();
  const count = section.data.filter(i => !i._isAd && !i._isInternalAd).length;
  return (
    <View style={[styles.daySep, { backgroundColor: colors['bg.base'] }]}>
      <Text style={[
        styles.daySepLabel,
        { color: section.isToday ? colors['action.primary'] : colors['text.secondary'] },
      ]}>
        {section.label}
      </Text>
      <View style={[styles.daySepLine, { backgroundColor: colors['border.subtle'] }]} />
      {count > 0 && (
        <Text variant="caption" color="text.tertiary">
          {count} {count === 1 ? 'plan' : 'planes'}
        </Text>
      )}
    </View>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const [events,         setEvents]         = useState([]);
  const [activeTab,      setActiveTab]      = useState('parati');
  const [timeFilter,     setTimeFilter]     = useState(null);
  const [following,      setFollowing]      = useState([]);
  const [userLocation,   setUserLocation]   = useState('');
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(false);
  const [refreshing,     setRefreshing]     = useState(false);
  const [loadingMore,    setLoadingMore]    = useState(false);
  const [lastDoc,        setLastDoc]        = useState(null);
  const [hasMore,        setHasMore]        = useState(true);
  const [interestVector, setInterestVector] = useState({});
  const [userInterests,  setUserInterests]  = useState([]);
  const [hiddenIds,      setHiddenIds]      = useState(new Set());
  const [internalAds,    setInternalAds]    = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const visibleSinceRef   = useRef({});
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 });
  const userId = auth.currentUser?.uid;
  const { data: externalEvents } = useExternalEvents();

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
      base = sortAsc(native.filter(ev => following?.includes(ev.organizerId)));
    } else {
      const validExternal = externalEvents.filter(e => e.dateISO ? new Date(e.dateISO) >= today : true);
      base = scoreAndRankEvents([...native, ...validExternal], interestVector, hiddenIds, userInterests);
    }
    return applyTimeFilter(base, timeFilter);
  }, [activeTab, events, following, externalEvents, interestVector, hiddenIds, userInterests, timeFilter, isExpired]);

  const sections = useMemo(
    () => groupByDay(displayedEvents, internalAds),
    [displayedEvents, internalAds]
  );

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
      if (item._isAd || item._isInternalAd) return;
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

  const renderItem = useCallback(({ item }) => {
    if (item._isInternalAd) {
      return <InternalAdCard ad={item.ad} onEventPress={id => navigation.navigate('EventDetail', { eventId: id })} />;
    }
    if (item._isAd) return <NativeAdCard />;

    // Eventos externos → sheet dedicado. Eventos nativos → detalle de la app.
    const route = item._isExternal ? 'ExternalEventDetail' : 'EventDetail';
    return (
      <EventRow
        event={item}
        trailing="auto"
        onPress={() => navigation.navigate(route, { event: item })}
      />
    );
  }, [navigation]);

  const renderSectionHeader = useCallback(({ section }) => (
    <DaySeparator section={section} />
  ), []);

  const ListFooter = () => {
    if (loadingMore) return <><SkeletonEventRow /><SkeletonEventRow /></>;
    if (!hasMore && displayedEvents.length > 0) {
      return (
        <View style={[styles.endOfFeed, { borderTopColor: colors['border.subtle'] }]}>
          <Text variant="caption" color="text.tertiary" align="center">
            No hay más eventos esta semana
          </Text>
          <Button variant="ghost" size="sm" label="Ver la próxima semana" onPress={() => {}} />
        </View>
      );
    }
    return <View style={{ height: space[12] }} />;
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
        <HomeHeader colors={colors} navigation={navigation} unread={unreadMessages} location={userLocation} />
        <HomeTabs activeTab={activeTab} onSelect={setActiveTab} />
        <HomeChips active={timeFilter} onSelect={() => {}} />
        <SkeletonList count={5} />
      </SafeAreaView>
    );
  }

  // ── Error inline ──────────────────────────────────────────────────────────

  if (error) {
    return (
      <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
        <HomeHeader colors={colors} navigation={navigation} unread={unreadMessages} location={userLocation} />
        <EmptyState
          icon={<Ionicons name="cloud-offline-outline" size={28} color={colors['text.tertiary']} />}
          title="No pudimos cargar el feed"
          actionLabel="Reintentar"
          onAction={() => { setError(false); setLoading(true); loadUserProfile(); }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>

      {/* 1 · HEADER — flexShrink 0 */}
      <HomeHeader colors={colors} navigation={navigation} unread={unreadMessages} location={userLocation} />

      {/* 2 · SEGMENTED — flexShrink 0 */}
      <HomeTabs activeTab={activeTab} onSelect={setActiveTab} />

      {/* 3 · CHIPS — flexShrink 0, chips de 42px */}
      <HomeChips active={timeFilter} onSelect={f => setTimeFilter(prev => prev === f ? null : f)} />

      {/* 4 · FEED — único bloque que crece */}
      {displayedEvents.length === 0 ? (
        <EmptyState
          icon={<Ionicons name={activeTab === 'siguiendo' ? 'people-outline' : 'sparkles-outline'} size={28} color={colors['text.tertiary']} />}
          title={activeTab === 'siguiendo' ? t.home.empty.following.title : t.home.empty.forYou.title}
          description={activeTab === 'siguiendo' ? t.home.empty.following.desc : t.home.empty.forYou.desc}
          actionLabel={activeTab === 'siguiendo' ? t.home.empty.following.action : t.home.empty.forYou.action}
          onAction={() => activeTab === 'siguiendo' ? navigation.navigate('Explore') : navigation.navigate('Interests')}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => item.id ?? `item_${index}`}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled
          showsVerticalScrollIndicator={false}
          ListFooterComponent={<ListFooter />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors['action.primary']}
            />
          }
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig.current}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function HomeHeader({ colors, navigation, unread, location }) {
  return (
    <View style={[styles.header, { flexShrink: 0 }]}>
      <Image source={require('../../assets/images/logo.png')} style={styles.logo} contentFit="cover" />

      {/* Título + ubicación */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: 17, color: colors['text.primary'] }}>
          Enfiestados
        </Text>
        <Pressable
          onPress={() => {}}
          accessibilityRole="button"
          accessibilityLabel="Cambiar ubicación"
        >
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={13} color={colors['text.tertiary']} />
            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: colors['text.tertiary'] }}>
              {location || 'Costa Rica'}
            </Text>
            <Ionicons name="chevron-down" size={12} color={colors['text.tertiary']} />
          </View>
        </Pressable>
      </View>

      {/* Mensajes con badge */}
      <Pressable
        onPress={() => navigation.navigate('Messages')}
        style={styles.iconBtn}
        accessibilityLabel="Mensajes"
      >
        <Ionicons name="chatbubble-outline" size={22} color={colors['text.primary']} />
        {unread > 0 && (
          <View style={[styles.badge, { backgroundColor: colors['status.urgent'], borderColor: colors['bg.base'] }]} />
        )}
      </Pressable>

      {/* Botón "Crear" — amarillo con texto */}
      <Pressable
        onPress={() => navigation.navigate('CreateEvent')}
        style={[styles.createChip, { backgroundColor: colors['action.primary'] }]}
        accessibilityLabel="Crear evento"
      >
        <Ionicons name="add" size={15} color={colors['text.onAction']} />
        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: colors['text.onAction'] }}>
          Crear
        </Text>
      </Pressable>
    </View>
  );
}

function HomeTabs({ activeTab, onSelect }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tabsRow, { flexShrink: 0, borderBottomColor: colors['border.subtle'] }]}>
      <SegmentedControl options={TABS} selected={activeTab} onSelect={onSelect} />
    </View>
  );
}

function HomeChips({ active, onSelect }) {
  // ── FIX_ROUND_2 § 2 ──
  // ScrollView: style.flexGrow=0 y style.flexShrink=0 → la fila NO crece
  // contentContainerStyle.alignItems='center' → los chips NO se estiran
  // FIX_ROUND_4 § 2: Chip (tokens) en vez de colores de un solo tema a mano
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipsScroll}          // flexGrow:0 flexShrink:0
      contentContainerStyle={styles.chipsContent}  // alignItems:'center'
    >
      {FILTERS.map(f => (
        <Chip
          key={f.value}
          label={f.label}
          selected={f.value === active}
          onPress={() => onSelect(f.value)}
        />
      ))}
    </ScrollView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },

  // Header: 1 fila, sin crecer
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingVertical: space[2],
    gap: 11,
    flexGrow: 0,
  },
  logo: { width: 36, height: 36, borderRadius: 11 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
  },
  createChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    gap: 4,
    flexShrink: 0,
  },

  // Tabs: no crece
  tabsRow: {
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexGrow: 0,
  },

  // Chips: fila horizontal de alto fijo
  chipsScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  chipsContent: {
    flexDirection: 'row',
    alignItems: 'center',   // ← clave: chips no se estiran
    gap: space[2],
    paddingHorizontal: space[5],
    paddingVertical: space[3],
  },

  // Separador de día
  daySep: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingTop: space[2],
    paddingBottom: 10,
    gap: space[3],
    flexGrow: 0,
    flexShrink: 0,
  },
  daySepLabel: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 12,
    letterSpacing: 1.2,
    flexShrink: 0,
  },
  daySepLine: { flex: 1, height: 1 },

  // Footer
  endOfFeed: {
    alignItems: 'center',
    paddingVertical: space[8],
    marginHorizontal: space[5],
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space[2],
  },
});

// HomeScreen — reconstrucción según FIX_ROUND_2 § 3
// SectionList con sticky headers por día, fila de chips correcta, badge correcto.
// Lógica de datos/hooks intacta.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Pressable, RefreshControl, SectionList,
  ScrollView, StyleSheet, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import InternalAdCard from '../components/InternalAdCard';
import NativeAdCard from '../components/NativeAdCard';
import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import EmptyState from '../components/ui/EmptyState';
import EventCardLarge from '../components/ui/EventCardLarge';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { SkeletonEventRow, SkeletonList } from '../components/ui/Skeleton';
import Text from '../components/ui/Text';

import { auth, db, functions } from '../config/firebase';
import useBlockedUsers from '../hooks/useBlockedUsers';
import useExternalEvents from '../hooks/useExternalEvents';
import { formatDaySeparator } from '../lib/format';
import { requireAccount } from '../lib/requireAccount';
import { isInZone, useZonePreference } from '../lib/zonePreference';
import { fetchActiveAds } from '../services/adService';
import { fetchMoreEvents, subscribeToEvents } from '../services/eventService';
import useVisiblePrivateEvents, { mergeEvents } from '../hooks/useVisiblePrivateEvents';
import { registerForPushNotifications } from '../services/pushNotificationService';
import { getHiddenEventIds, recordSignal } from '../services/signalService';
import { scoreAndRankEvents } from '../services/feedService';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { useTranslation } from 'react-i18next';

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
  { labelKey: 'home.tabs.forYou',    value: 'parati' },
  { labelKey: 'home.tabs.following', value: 'siguiendo' },
];

const FILTERS = [
  { labelKey: 'home.filters.today',   value: 'today' },
  { labelKey: 'home.filters.weekend', value: 'weekend' },
  { labelKey: 'home.filters.free',    value: 'free' },
];

// Alto natural de la fila de chips (paddingVertical space[3]*2 + Chip 44px) —
// § 3.2: la Animated.View que la envuelve necesita un alto de arranque fijo.
const CHIPS_ROW_HEIGHT = 68;
// Compactar/expandir el header al scrollear (ver handleFeedScroll).
const CHROME_ANIM_MS = 180;
const CHROME_TOGGLE_PX = 24;

// Fallback de HomeHeader cuando no hay scroll que compactarlo (loading/error).
const STATIC_ZERO = new Animated.Value(0);

// ─── DaySeparator — sticky, fondo opaco ──────────────────────────────────────

function DaySeparator({ section }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
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
          {t(count === 1 ? 'home.planOne' : 'home.planMany', { count })}
        </Text>
      )}
    </View>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const privateEvents = useVisiblePrivateEvents();
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
  const [savedExternalIds, setSavedExternalIds] = useState(new Set());
  const { allBlocked } = useBlockedUsers();
  const { zone } = useZonePreference();

  const visibleSinceRef   = useRef({});
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 });
  const userId = auth.currentUser?.uid;
  const { data: externalEvents } = useExternalEvents();

  // § 3.2/3.3 — mitigaciones de densidad de la card grande: header y chips
  // se compactan al pasar los primeros 80px y vuelven al hacer scroll hacia
  // arriba. El índice se decide por dirección (dy), no solo por posición.
  const [chromeCollapsed, setChromeCollapsed] = useState(false);
  const chromeCollapsedRef = useRef(false);
  const collapseAnim = useRef(new Animated.Value(0)).current;
  // Punto de giro: lo más arriba (expandido) o lo más abajo (compactado) que
  // llegó el scroll desde el último cambio. Se compara contra él, no contra
  // el evento anterior, para exigir un recorrido real en la otra dirección.
  const scrollAnchorRef = useRef(0);
  const ignoreScrollUntilRef = useRef(0);

  useEffect(() => {
    Animated.timing(collapseAnim, {
      toValue: chromeCollapsed ? 1 : 0,
      duration: CHROME_ANIM_MS,
      useNativeDriver: false, // anima height/padding, no soporta el driver nativo
    }).start();
  }, [chromeCollapsed, collapseAnim]);

  // Compactar el header le cambia el alto a la lista (~70px). Con el dedo
  // apoyado, iOS/Android lo compensan moviendo el contentOffset esos mismos
  // px en sentido contrario, y eso se leía como "scroll hacia arriba" →
  // volvía a expandir → la lista bajaba → "scroll hacia abajo" → compactaba…
  // El header parpadeaba varias veces por segundo (VIDEO BUG, nov 2026).
  // Por eso: se ignora el scroll mientras dura la animación, y para cambiar
  // de estado hace falta recorrer CHROME_TOGGLE_PX en la nueva dirección.
  const handleFeedScroll = useCallback((e) => {
    const y = e.nativeEvent.contentOffset.y;
    if (Date.now() < ignoreScrollUntilRef.current) {
      scrollAnchorRef.current = y;
      return;
    }
    const setCollapsed = (value) => {
      chromeCollapsedRef.current = value;
      setChromeCollapsed(value);
      ignoreScrollUntilRef.current = Date.now() + CHROME_ANIM_MS + 120;
      scrollAnchorRef.current = y;
    };
    if (!chromeCollapsedRef.current) {
      scrollAnchorRef.current = Math.min(scrollAnchorRef.current, y);
      if (y > 80 && y - scrollAnchorRef.current > CHROME_TOGGLE_PX) setCollapsed(true);
    } else {
      scrollAnchorRef.current = Math.max(scrollAnchorRef.current, y);
      if (y <= 0 || scrollAnchorRef.current - y > CHROME_TOGGLE_PX) setCollapsed(false);
    }
  }, []);

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
        setSavedExternalIds(new Set(data.savedExternalIds || []));
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
    // events = feed público; privateEvents = de perfiles privados que sigo.
    const native = mergeEvents(events, privateEvents).filter(ev => !isExpired(ev) && !allBlocked.has(ev.organizerId) && isInZone(ev, zone));
    let base;
    if (activeTab === 'siguiendo') {
      base = sortAsc(native.filter(ev => following?.includes(ev.organizerId)));
    } else {
      const validExternal = externalEvents.filter(e => (e.dateISO ? new Date(e.dateISO) >= today : true) && isInZone(e, zone));
      base = scoreAndRankEvents([...native, ...validExternal], interestVector, hiddenIds, userInterests);
    }
    return applyTimeFilter(base, timeFilter);
  }, [activeTab, events, privateEvents, following, externalEvents, interestVector, hiddenIds, userInterests, timeFilter, isExpired, allBlocked, zone]);

  const sections = useMemo(
    () => groupByDay(displayedEvents, internalAds),
    // i18n.language: las etiquetas de día ("HOY · VIERNES 25") salen del idioma.
    [displayedEvents, internalAds, i18n.language]
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
      <EventCardLarge
        event={item}
        variant="large"
        savedExternalIds={savedExternalIds}
        onPress={() => navigation.navigate(route, { event: item })}
      />
    );
  }, [navigation, savedExternalIds]);

  const renderSectionHeader = useCallback(({ section }) => (
    <DaySeparator section={section} />
  ), []);

  const ListFooter = () => {
    if (loadingMore) return <><SkeletonEventRow /><SkeletonEventRow /></>;
    if (!hasMore && displayedEvents.length > 0) {
      return (
        <View style={[styles.endOfFeed, { borderTopColor: colors['border.subtle'] }]}>
          <Text variant="caption" color="text.tertiary" align="center">
            {t('home.endOfFeed')}
          </Text>
          <Button variant="ghost" size="sm" label={t('home.nextWeek')} onPress={() => {}} />
        </View>
      );
    }
    return <View style={{ height: space[12] }} />;
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
        <HomeHeader colors={colors} navigation={navigation} location={userLocation} />
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
        <HomeHeader colors={colors} navigation={navigation} location={userLocation} />
        <EmptyState
          icon={<Ionicons name="cloud-offline-outline" size={28} color={colors['text.tertiary']} />}
          title={t('home.error.title')}
          actionLabel={t('common.retry')}
          onAction={() => { setError(false); setLoading(true); loadUserProfile(); }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>

      {/* 1 · HEADER — flexShrink 0, se compacta a 44px al scrollear (§ 3.3) */}
      <HomeHeader colors={colors} navigation={navigation} location={userLocation} collapseAnim={collapseAnim} />

      {/* 2 · SEGMENTED — flexShrink 0 */}
      <HomeTabs activeTab={activeTab} onSelect={setActiveTab} />

      {/* 3 · CHIPS — flexShrink 0, se oculta al scrollear y reaparece al subir (§ 3.2) */}
      <Animated.View
        style={{
          height: collapseAnim.interpolate({ inputRange: [0, 1], outputRange: [CHIPS_ROW_HEIGHT, 0] }),
          opacity: collapseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          overflow: 'hidden',
        }}
      >
        <HomeChips active={timeFilter} onSelect={f => setTimeFilter(prev => prev === f ? null : f)} />
      </Animated.View>

      {/* 4 · FEED — único bloque que crece */}
      {displayedEvents.length === 0 ? (
        <EmptyState
          icon={<Ionicons name={activeTab === 'siguiendo' ? 'people-outline' : 'sparkles-outline'} size={28} color={colors['text.tertiary']} />}
          title={activeTab === 'siguiendo' ? t('home.empty.following.title') : t('home.empty.forYou.title')}
          description={activeTab === 'siguiendo' ? t('home.empty.following.desc') : t('home.empty.forYou.desc')}
          actionLabel={activeTab === 'siguiendo' ? t('home.empty.following.action') : t('home.empty.forYou.action')}
          onAction={() => activeTab === 'siguiendo' ? navigation.navigate('Explore') : navigation.navigate('Interests')}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => item.id ?? `item_${index}`}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          // Sin sticky: clavado arriba, el DaySeparator comía ~34px de forma
          // permanente y nunca dejaba ver una tarjeta entera. La fecha ya va
          // dos veces en la propia tarjeta (el badge del día y la fila
          // "Lun 19 oct"), así que fijarla arriba era redundante. Ahora el
          // separador scrollea junto con el contenido.
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          // Sin esto la última tarjeta termina al ras del borde superior de la
          // tab bar y el botón "Comprar" se ve guillotinado por la barra.
          contentContainerStyle={{ paddingBottom: space[6] }}
          ListFooterComponent={<ListFooter />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          onScroll={handleFeedScroll}
          scrollEventThrottle={32}
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

// § 3.3: header + wordmark + ubicación colapsan a una fila de 44px al
// scrollear. collapseAnim es opcional (las pantallas de loading/error lo
// omiten y quedan siempre expandidas — no scrollean).
function HomeHeader({ colors, navigation, location, collapseAnim }) {
  const anim = collapseAnim ?? STATIC_ZERO;
  const { zone } = useZonePreference();
  const { t } = useTranslation();
  // Con zona activa se muestra el radio, para que quede claro por qué el
  // feed tiene menos eventos que el de todo el país.
  const locationLabel = zone
    ? `${location || t('home.myZone')} · ${zone.radiusKm} km`
    : (location || 'Costa Rica');
  return (
    <Animated.View style={[
      styles.header,
      {
        flexShrink: 0,
        paddingVertical: anim.interpolate({ inputRange: [0, 1], outputRange: [space[2], 2] }),
      },
    ]}>
      <Image source={require('../../assets/images/logo.png')} style={styles.logo} contentFit="cover" />

      {/* Título + ubicación */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: 17, color: colors['text.primary'] }}>
          Enfiestados
        </Text>
        <Animated.View style={{
          opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          // 20, no 18: el texto de abajo es de 14px y su caja de línea mide 18.
          // Con overflow:'hidden' y 18 de alto, la cola de la "j" quedaba
          // cortada y "Alajuela" se leía "Alaiuela".
          height: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }),
          overflow: 'hidden',
        }}>
          <Pressable
            onPress={() => navigation.navigate('ZoneSettings')}
            accessibilityRole="button"
            accessibilityLabel={t('home.changeZone')}
          >
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={13} color={colors['text.tertiary']} />
              {/* lineHeight explícito: sin él iOS calcula la caja de línea según
                  la métrica de la fuente y el alto queda impredecible dentro
                  del contenedor con overflow:'hidden' de arriba. */}
              <Text style={{ fontSize: 14, lineHeight: 18, fontFamily: 'PlusJakartaSans_500Medium', color: colors['text.tertiary'] }}>
                {locationLabel}
              </Text>
              <Ionicons name="chevron-down" size={12} color={colors['text.tertiary']} />
            </View>
          </Pressable>
        </Animated.View>
      </View>

      {/* Los mensajes viven en la pestaña Alertas (NotificationsScreen). */}
      {/* Botón "Crear" — amarillo con texto */}
      <Pressable
        onPress={() => {
          if (!requireAccount(navigation, t('home.needAccountCreate'))) return;
          navigation.navigate('CreateEvent');
        }}
        style={[styles.createChip, { backgroundColor: colors['action.primary'] }]}
        hitSlop={4}
        accessibilityLabel={t('home.createEvent')}
      >
        <Ionicons name="add" size={15} color={colors['text.onAction']} />
        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors['text.onAction'] }}>
          {t('home.create')}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function HomeTabs({ activeTab, onSelect }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={[styles.tabsRow, { flexShrink: 0, borderBottomColor: colors['border.subtle'] }]}>
      <SegmentedControl options={TABS.map(o => ({ ...o, label: t(o.labelKey) }))} selected={activeTab} onSelect={onSelect} />
    </View>
  );
}

function HomeChips({ active, onSelect }) {
  // ── FIX_ROUND_2 § 2 ──
  // ScrollView: style.flexGrow=0 y style.flexShrink=0 → la fila NO crece
  // contentContainerStyle.alignItems='center' → los chips NO se estiran
  // FIX_ROUND_4 § 2: Chip (tokens) en vez de colores de un solo tema a mano
  const { t } = useTranslation();
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
          label={t(f.labelKey)}
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

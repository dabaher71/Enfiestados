// SearchScreen (Explorar) — lista + mapa con filtros.
// LÓGICA INTACTA: mapa, marcadores, filtros, eventos externos, ads.
// PRESENTACIÓN: design system v1.1 — tokens, EventRow, EmptyState, Sheet.
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, FlatList, Pressable, ScrollView, StyleSheet, View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';

import NativeAdCard from '../components/NativeAdCard';
import Chip from '../components/ui/Chip';
import EmptyState from '../components/ui/EmptyState';
import EventRow from '../components/ui/EventRow';
import { SearchField } from '../components/ui/Input';
import Sheet from '../components/ui/Sheet';
import { SkeletonList } from '../components/ui/Skeleton';
import StatusBadge from '../components/ui/StatusBadge';
import Text from '../components/ui/Text';
import Button from '../components/ui/Button';

import { formatEventDate, formatPrice } from '../lib/format';
import { safeOpenURL } from '../utils/security';
import useExternalEvents from '../hooks/useExternalEvents';
import { subscribeToEvents } from '../services/eventService';
import { CATEGORIES as BASE_CATEGORIES, getCategoryColor } from '../constants/categories';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import t from '../i18n/es-CR.json';

// ─── Constantes ───────────────────────────────────────────────────────────────

const { width } = Dimensions.get('window');
const CARD_W = width * 0.75;
const CARD_H = 190;

const COSTA_RICA = { latitude: 9.9281, longitude: -84.0907, latitudeDelta: 0.5, longitudeDelta: 0.5 };

const CATEGORIES = [
  { id: 'all', label: 'Todos', icon: 'apps' },
  ...BASE_CATEGORIES.map(c => ({ id: c.id, label: c.name, icon: c.icon })),
];

const TIME_OPTS = [
  { id: 'all',      label: 'Cualquier fecha' },
  { id: 'today',    label: 'Hoy' },
  { id: 'tomorrow', label: 'Mañana' },
  { id: 'week',     label: 'Esta semana' },
  { id: 'month',    label: 'Este mes' },
];

const PROVINCES = [
  { id: 'all',         label: 'Todas',       lat: 9.9281,  lng: -84.0907 },
  { id: 'San José',    label: 'San José',    lat: 9.9281,  lng: -84.0907 },
  { id: 'Alajuela',   label: 'Alajuela',    lat: 10.0162, lng: -84.2115 },
  { id: 'Cartago',    label: 'Cartago',     lat: 9.8644,  lng: -83.9194 },
  { id: 'Heredia',    label: 'Heredia',     lat: 10.0024, lng: -84.1165 },
  { id: 'Guanacaste', label: 'Guanacaste',  lat: 10.4274, lng: -85.4520 },
  { id: 'Puntarenas', label: 'Puntarenas',  lat: 9.9762,  lng: -84.8382 },
  { id: 'Limón',      label: 'Limón',       lat: 9.9907,  lng: -83.0359 },
];

// ─── Helpers de filtrado (fuera del componente — sin recreación) ──────────────

function getEventTs(ev) {
  if (ev?._isExternal) {
    const ts = ev.dateISO ? new Date(ev.dateISO).getTime() : Infinity;
    return isNaN(ts) ? Infinity : ts;
  }
  const d = ev?.date;
  if (!d) return Infinity;
  const parts = d.split('/');
  if (parts.length === 3) {
    const ts = new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime();
    if (!isNaN(ts)) return ts;
  }
  return isNaN(Date.parse(d)) ? Infinity : Date.parse(d);
}

function parseDate(s) {
  if (!s) return null;
  const p = s.split('/');
  return p.length === 3 ? new Date(p[2], p[1] - 1, p[0]) : null;
}

function isInTimeRange(dateStr, filter) {
  const d = parseDate(dateStr);
  if (!d) return true;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const endWeek  = new Date(today); endWeek.setDate(today.getDate() + (7 - today.getDay()));
  const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  if (filter === 'today')    return d.toDateString() === today.toDateString();
  if (filter === 'tomorrow') return d.toDateString() === tomorrow.toDateString();
  if (filter === 'week')     return d >= today && d <= endWeek;
  if (filter === 'month')    return d >= today && d <= endMonth;
  return true;
}

// ─── Marcador del mapa ────────────────────────────────────────────────────────

function MapMarkerBubble({ event, isSelected, colors }) {
  return (
    <View style={[
      styles.markerBubble,
      {
        backgroundColor: isSelected ? colors['action.primary'] : colors['bg.raised'],
        borderColor: isSelected ? colors['action.primary'] : colors['border.strong'],
      },
    ]}>
      <Text
        variant="caption"
        style={{ color: isSelected ? colors['text.onAction'] : colors['text.primary'], fontFamily: 'PlusJakartaSans_700Bold' }}
      >
        {event.isFree ? 'Gratis' : `₡${event.price}`}
      </Text>
    </View>
  );
}

// ─── SearchScreen ─────────────────────────────────────────────────────────────

export default function SearchScreen({ navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [events,          setEvents]          = useState([]);
  const [visibleEvents,   setVisibleEvents]   = useState([]);
  const [query,           setQuery]           = useState('');
  const [category,        setCategory]        = useState('all');
  const [timeFilter,      setTimeFilter]      = useState('all');
  const [province,        setProvince]        = useState('all');
  const [viewMode,        setViewMode]        = useState('map');
  const [selectedEvent,   setSelectedEvent]   = useState(null);
  const [mapRegion,       setMapRegion]       = useState(COSTA_RICA);
  const [showFilters,     setShowFilters]     = useState(false);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(false);

  const mapRef      = useRef(null);
  const listRef     = useRef(null);
  const { data: externalEvents } = useExternalEvents();

  // ── Carga ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const unsub = subscribeToEvents(
      (newEvents) => {
        setEvents(newEvents.filter(e => e.location?.lat && e.location?.lng && !e.isVirtual));
        setLoading(false);
        setError(false);
      },
      () => { setLoading(false); setError(true); }
    );
    return () => unsub();
  }, []);

  // ── Filtrado ───────────────────────────────────────────────────────────────

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const filteredNative = useMemo(() => {
    let f = events.filter(e => { const d = parseDate(e.date); return !d || d >= today; });
    if (query.trim()) {
      const q = query.toLowerCase();
      f = f.filter(e =>
        e.title?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.location?.name?.toLowerCase().includes(q) ||
        e.organizerName?.toLowerCase().includes(q)
      );
    }
    if (category !== 'all') f = f.filter(e => e.category === category);
    if (timeFilter !== 'all') f = f.filter(e => isInTimeRange(e.date, timeFilter));
    if (province !== 'all') {
      const p = PROVINCES.find(x => x.id === province);
      if (p) f = f.filter(e => {
        const dLat = e.location.lat - p.lat, dLng = e.location.lng - p.lng;
        return dLat*dLat + dLng*dLng < 0.25;
      });
    }
    return f;
  }, [events, query, category, timeFilter, province, today]);

  const filteredExternal = useMemo(() => {
    let f = externalEvents.filter(e => e.dateISO ? new Date(e.dateISO) >= today : true);
    if (query.trim()) {
      const q = query.toLowerCase();
      f = f.filter(e =>
        e.title?.toLowerCase().includes(q) ||
        e.locationText?.toLowerCase().includes(q) ||
        e.source?.toLowerCase().includes(q)
      );
    }
    return f;
  }, [externalEvents, query, today]);

  useEffect(() => { setVisibleEvents(filteredNative); }, [filteredNative]);

  const listData = useMemo(() => {
    const all = [...filteredNative, ...filteredExternal]
      .slice().sort((a, b) => getEventTs(a) - getEventTs(b));
    const result = [];
    all.forEach((ev, i) => {
      result.push(ev);
      if ((i + 1) % 6 === 0 && i >= 3) result.push({ _isAd: true, id: `ad_${i}` });
    });
    return result;
  }, [filteredNative, filteredExternal]);

  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (category !== 'all') n++;
    if (timeFilter !== 'all') n++;
    if (province !== 'all') n++;
    return n;
  }, [category, timeFilter, province]);

  // ── Interacciones de mapa ──────────────────────────────────────────────────

  const handleMarkerPress = useCallback((event, index) => {
    setSelectedEvent(event);
    mapRef.current?.animateToRegion({
      latitude: event.location.lat, longitude: event.location.lng,
      latitudeDelta: 0.02, longitudeDelta: 0.02,
    }, 300);
    const vi = visibleEvents.findIndex(e => e.id === event.id);
    if (vi >= 0) listRef.current?.scrollToIndex({ index: vi, animated: true });
  }, [visibleEvents]);

  const onRegionChangeComplete = useCallback((region) => {
    setMapRegion(region);
    setVisibleEvents(filteredNative.filter(e =>
      e.location.lat >= region.latitude  - region.latitudeDelta  / 2 &&
      e.location.lat <= region.latitude  + region.latitudeDelta  / 2 &&
      e.location.lng >= region.longitude - region.longitudeDelta / 2 &&
      e.location.lng <= region.longitude + region.longitudeDelta / 2
    ));
  }, [filteredNative]);

  const onCarouselScroll = useCallback((e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / (CARD_W + space[3]));
    const ev = visibleEvents[i];
    if (ev) {
      setSelectedEvent(ev);
      mapRef.current?.animateToRegion({
        latitude: ev.location.lat, longitude: ev.location.lng,
        latitudeDelta: 0.02, longitudeDelta: 0.02,
      }, 300);
    }
  }, [visibleEvents]);

  const handleCardPress = useCallback((event) => {
    if (event._isExternal) safeOpenURL(event.eventUrl);
    else navigation.navigate('EventDetail', { event });
  }, [navigation]);

  const clearFilters = useCallback(() => {
    setCategory('all'); setTimeFilter('all'); setProvince('all');
    setShowFilters(false);
  }, []);

  // ── Renders ────────────────────────────────────────────────────────────────

  const mapMarkers = useMemo(() =>
    filteredNative.map((ev, i) => (
      <Marker
        key={ev.id}
        coordinate={{ latitude: ev.location.lat, longitude: ev.location.lng }}
        onPress={() => handleMarkerPress(ev, i)}
      >
        <MapMarkerBubble event={ev} isSelected={selectedEvent?.id === ev.id} colors={colors} />
      </Marker>
    )),
  [filteredNative, selectedEvent, handleMarkerPress, colors]);

  const renderCarouselCard = useCallback(({ item }) => (
    <Pressable
      style={[
        styles.mapCard,
        {
          backgroundColor: colors['bg.raised'],
          borderColor: selectedEvent?.id === item.id ? colors['action.primary'] : 'transparent',
          borderWidth: selectedEvent?.id === item.id ? 2 : 0,
        },
      ]}
      onPress={() => handleCardPress(item)}
    >
      {(item.imageUrl || item.image) && (
        <View style={styles.mapCardImg}>
          <Animated.Image
            source={{ uri: item.imageUrl || item.image }}
            style={styles.mapCardImg}
            resizeMode="cover"
          />
        </View>
      )}
      <View style={styles.mapCardBody}>
        <Text variant="overline" color="text.tertiary" numberOfLines={1}>
          {item.category?.toUpperCase()} · {formatEventDate(item.date, item.time)}
        </Text>
        <Text variant="title" numberOfLines={2} style={{ marginTop: space[1] }}>{item.title}</Text>
        <View style={[styles.mapCardFooter, { marginTop: space[2] }]}>
          {item.location?.name && (
            <Text variant="caption" color="text.tertiary" numberOfLines={1} style={{ flex: 1 }}>
              {item.location.name}
            </Text>
          )}
          <StatusBadge
            label={formatPrice(item.price, item.isFree)}
            variant={item.isFree ? 'free' : 'neutral'}
          />
        </View>
      </View>
    </Pressable>
  ), [selectedEvent, handleCardPress, colors]);

  const renderListItem = useCallback(({ item }) => {
    if (item._isAd) return <NativeAdCard />;
    return (
      <EventRow
        event={item}
        trailing="price"
        onPress={() => handleCardPress(item)}
      />
    );
  }, [handleCardPress]);

  // ── Layout ─────────────────────────────────────────────────────────────────

  const totalCount = viewMode === 'map' ? visibleEvents.length : listData.filter(i => !i._isAd).length;

  return (
    <View style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>

      {/* Header — búsqueda + acciones */}
      <View style={[styles.header, { paddingTop: insets.top + space[2] }]}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={t.explore.searchPlaceholder}
          style={styles.searchField}
        />
        <Pressable
          onPress={() => setShowFilters(true)}
          style={[styles.iconBtn, { backgroundColor: activeFiltersCount > 0 ? colors['action.primary'] : colors['bg.surface'] }]}
          accessibilityLabel={t.explore.filters}
          accessibilityRole="button"
        >
          <Ionicons name="options-outline" size={20} color={activeFiltersCount > 0 ? colors['text.onAction'] : colors['text.primary']} />
          {activeFiltersCount > 0 && (
            <View style={[styles.filterBadge, { backgroundColor: colors['status.urgent'], borderColor: colors['bg.base'] }]}>
              <Text style={{ fontSize: 9, color: '#fff', fontFamily: 'PlusJakartaSans_700Bold' }}>{activeFiltersCount}</Text>
            </View>
          )}
        </Pressable>
        <View style={[styles.viewToggle, { backgroundColor: colors['bg.surface'] }]}>
          {['map', 'list'].map(mode => (
            <Pressable
              key={mode}
              onPress={() => setViewMode(mode)}
              style={[styles.toggleBtn, viewMode === mode && { backgroundColor: colors['nav.selected'] }]}
              accessibilityRole="button"
              accessibilityLabel={mode === 'map' ? t.explore.viewMap : t.explore.viewList}
            >
              <Ionicons name={mode === 'map' ? 'map-outline' : 'list-outline'} size={18} color={viewMode === mode ? '#fff' : colors['text.tertiary']} />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Categorías */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {CATEGORIES.map(cat => (
          <Chip
            key={cat.id}
            label={cat.label}
            selected={category === cat.id}
            onPress={() => setCategory(cat.id)}
          />
        ))}
      </ScrollView>

      {/* Contador de resultados */}
      <View style={[styles.resultsRow, { borderBottomColor: colors['border.subtle'] }]}>
        <Text variant="caption" color="text.tertiary">
          {totalCount} {totalCount === 1 ? 'evento' : 'eventos'}
          {province !== 'all' ? ` en ${province}` : ''}
        </Text>
      </View>

      {/* Contenido principal */}
      {loading ? (
        <SkeletonList count={6} />
      ) : error ? (
        <EmptyState
          icon={<Ionicons name="cloud-offline-outline" size={28} color={colors['text.tertiary']} />}
          title={t.explore.error.title}
          actionLabel={t.explore.error.action}
          onAction={() => { setError(false); setLoading(true); }}
        />
      ) : viewMode === 'list' ? (
        filteredNative.length === 0 && filteredExternal.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="search-outline" size={28} color={colors['text.tertiary']} />}
            title={t.explore.empty.title}
            description={t.explore.empty.desc}
            actionLabel={t.explore.empty.action}
            onAction={() => { setProvince('all'); setCategory('all'); setTimeFilter('all'); }}
          />
        ) : (
          <FlashList
            data={listData}
            keyExtractor={item => item.id}
            renderItem={renderListItem}
            estimatedItemSize={96}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: space[12] }}
          />
        )
      ) : (
        /* Vista mapa */
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={mapRegion}
            onRegionChangeComplete={onRegionChangeComplete}
            showsUserLocation
            showsMyLocationButton={false}
          >
            {mapMarkers}
          </MapView>

          {/* FAB — centrar ubicación */}
          <Pressable
            style={[styles.fab, { backgroundColor: colors['bg.raised'] }]}
            onPress={() => mapRef.current?.animateToRegion(COSTA_RICA, 500)}
            accessibilityLabel="Centrar mapa"
          >
            <Ionicons name="locate-outline" size={22} color={colors['nav.selected']} />
          </Pressable>

          {/* Carrusel de cards */}
          {visibleEvents.length > 0 && (
            <Animated.FlatList
              ref={listRef}
              data={visibleEvents}
              keyExtractor={item => item.id}
              renderItem={renderCarouselCard}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_W + space[3]}
              snapToAlignment="start"
              decelerationRate="fast"
              contentContainerStyle={styles.carousel}
              onMomentumScrollEnd={onCarouselScroll}
              getItemLayout={(_, i) => ({ length: CARD_W + space[3], offset: (CARD_W + space[3]) * i, index: i })}
            />
          )}

          {visibleEvents.length === 0 && (
            <View style={[styles.mapEmptyBanner, { backgroundColor: colors['bg.raised'] }]}>
              <Text variant="caption" color="text.secondary">No hay eventos en esta zona</Text>
              <Pressable onPress={() => mapRef.current?.animateToRegion(COSTA_RICA, 500)}>
                <Text variant="label" color="nav.selected">Ampliar</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Sheet de filtros avanzados */}
      <Sheet visible={showFilters} onClose={() => setShowFilters(false)} height="half" title="Filtros">
        <ScrollView contentContainerStyle={styles.filtersContent}>
          <Text variant="overline" color="text.tertiary" style={{ marginBottom: space[3] }}>FECHA</Text>
          <View style={styles.filterChips}>
            {TIME_OPTS.map(opt => (
              <Chip key={opt.id} label={opt.label} selected={timeFilter === opt.id} onPress={() => setTimeFilter(opt.id)} />
            ))}
          </View>

          <Text variant="overline" color="text.tertiary" style={{ marginTop: space[4], marginBottom: space[3] }}>PROVINCIA</Text>
          <View style={styles.filterChips}>
            {PROVINCES.map(p => (
              <Chip key={p.id} label={p.label} selected={province === p.id} onPress={() => {
                setProvince(p.id);
                if (p.id !== 'all') {
                  mapRef.current?.animateToRegion({ latitude: p.lat, longitude: p.lng, latitudeDelta: 0.3, longitudeDelta: 0.3 }, 500);
                }
              }} />
            ))}
          </View>

          <View style={styles.filterActions}>
            <Button variant="ghost" size="sm" label="Limpiar" onPress={clearFilters} />
            <Button variant="primary" size="md" label={`Aplicar${activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}`} onPress={() => setShowFilters(false)} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </Sheet>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingBottom: space[3],
    gap: space[2],
  },
  searchField: { flex: 1 },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 3,
    gap: 2,
  },
  toggleBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },

  chips: {
    paddingHorizontal: space[5],
    paddingBottom: space[3],
    gap: space[2],
  },

  resultsRow: {
    paddingHorizontal: space[5],
    paddingBottom: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  mapContainer: { flex: 1 },
  map: { flex: 1 },

  fab: {
    position: 'absolute',
    top: space[3],
    right: space[3],
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },

  carousel: {
    position: 'absolute',
    bottom: space[4],
    paddingHorizontal: space[5],
    gap: space[3],
  },
  mapCard: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginRight: space[3],
  },
  mapCardImg: { width: '100%', height: 90 },
  mapCardBody: { padding: space[3], flex: 1, justifyContent: 'space-between' },
  mapCardFooter: { flexDirection: 'row', alignItems: 'center', gap: space[2] },

  mapEmptyBanner: {
    position: 'absolute',
    bottom: space[8],
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.full,
    gap: space[3],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },

  markerBubble: {
    paddingHorizontal: space[3],
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },

  filtersContent: { padding: space[5], gap: space[2] },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  filterActions: { flexDirection: 'row', gap: space[3], marginTop: space[6] },
});

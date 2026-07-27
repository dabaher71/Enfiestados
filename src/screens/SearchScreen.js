// SearchScreen (Explorar) — reconstrucción según FIX_ROUND_2 § 5
// Abre en lista. Encabezado editorial. SegmentedControl con texto.
// Grilla de categorías. Mapa oscuro con pines amarillos + sheet peek.
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, FlatList, Platform, Pressable,
  ScrollView, StyleSheet, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';

import NativeAdCard from '../components/NativeAdCard';
import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import EmptyState from '../components/ui/EmptyState';
import EventRow from '../components/ui/EventRow';
import { SkeletonList } from '../components/ui/Skeleton';
import Text from '../components/ui/Text';
import Sheet from '../components/ui/Sheet';

import useExternalEvents from '../hooks/useExternalEvents';
import { subscribeToEvents } from '../services/eventService';
import { CATEGORIES } from '../constants/categories';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';

// ─── Constantes ───────────────────────────────────────────────────────────────

const { width: SW, height: SH } = Dimensions.get('window');
const COSTA_RICA = { latitude: 9.9281, longitude: -84.0907, latitudeDelta: 0.5, longitudeDelta: 0.5 };
const CARD_W = SW * 0.75;

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

const TIME_OPTS = [
  { id: 'all',      label: 'Cualquier fecha' },
  { id: 'today',    label: 'Hoy' },
  { id: 'tomorrow', label: 'Mañana' },
  { id: 'week',     label: 'Esta semana' },
  { id: 'month',    label: 'Este mes' },
];

// Estilo oscuro para MapView
const DARK_MAP_STYLE = [
  { elementType: 'geometry',           stylers: [{ color: '#17131F' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#9A91AD' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#17131F' }] },
  { featureType: 'road',               elementType: 'geometry',       stylers: [{ color: '#2C2639' }] },
  { featureType: 'road',               elementType: 'geometry.stroke',stylers: [{ color: '#17131F' }] },
  { featureType: 'road.highway',       elementType: 'geometry',       stylers: [{ color: '#3D3650' }] },
  { featureType: 'water',              elementType: 'geometry',       stylers: [{ color: '#0F0C18' }] },
  { featureType: 'poi',                stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',            stylers: [{ visibility: 'off' }] },
];

// ─── Helpers de filtrado ──────────────────────────────────────────────────────

function getTs(ev) {
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

// ─── Marcador de precio — § 3.4: oscuro para precio, verde para gratis ───────

function PricePin({ event, selected, colors }) {
  const isFree = event.isFree === true || event.price === 0;
  const label  = isFree
    ? 'Gratis'
    : typeof event.price === 'number' ? `₡${event.price}` : '';
  if (!label) return null;

  return (
    <View style={[
      styles.pin,
      selected && styles.pinSelected,
      isFree
        ? { backgroundColor: colors['status.free'] }
        : { backgroundColor: '#1C1726' },         // oscuro para precio (§ 3.4)
      selected && { borderWidth: 2, borderColor: colors['action.primary'] },
    ]}>
      <Text style={{
        fontSize: 11.5,
        fontFamily: 'PlusJakartaSans_800ExtraBold',
        color: '#FDFBF7',
      }}>
        {label}
      </Text>
    </View>
  );
}

// ─── Grilla de categorías — § 3.1: fila (icono + texto), 74px, 6 + "Ver las 12"
// § 3.6: toLocaleUpperCase para MÚSICA, NATURALEZA con tildes

function CategoryGrid({ onSelect, colors, showAll, onToggleAll }) {
  const cellW = (SW - space[5] * 2 - space[2]) / 2;
  const displayed = showAll ? CATEGORIES : CATEGORIES.slice(0, 6);
  return (
    <>
      <View style={styles.catGrid}>
        {displayed.map(cat => (
          <Pressable
            key={cat.id}
            onPress={() => onSelect(cat.id)}
            style={[
              styles.catCell,
              { width: cellW, backgroundColor: `${cat.color}24`, borderColor: `${cat.color}42` },
            ]}
            accessibilityRole="button"
            accessibilityLabel={cat.name}
          >
            {/* Fila: icono + texto (no apilados) — permite nombres largos sin cortar (§ 3.1) */}
            <View style={[styles.catIconWrap, { backgroundColor: `${cat.color}18` }]}>
              <Ionicons name={cat.icon} size={22} color={cat.color} />
            </View>
            <Text style={{
              fontSize: 15.5,
              fontFamily: 'PlusJakartaSans_700Bold',
              color: colors['text.primary'],
              flex: 1,
              flexShrink: 1,
            }} numberOfLines={1} ellipsizeMode="tail">
              {cat.name}
            </Text>
          </Pressable>
        ))}
      </View>
      {!showAll && CATEGORIES.length > 6 && (
        <Pressable onPress={onToggleAll} style={styles.seeAllCats} accessibilityRole="button">
          <Text variant="label" color="link">Ver las {CATEGORIES.length} categorías</Text>
        </Pressable>
      )}
    </>
  );
}

// ─── SearchScreen ─────────────────────────────────────────────────────────────

export default function SearchScreen({ navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [events,        setEvents]        = useState([]);
  const [visibleEvents, setVisibleEvents] = useState([]);
  const [query,         setQuery]         = useState('');
  const [viewMode,      setViewMode]      = useState('list');  // ← lista por defecto
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [mapRegion,     setMapRegion]     = useState(COSTA_RICA);
  const [loading,       setLoading]       = useState(true);
  const [showFilters,   setShowFilters]   = useState(false);
  const [category,      setCategory]      = useState('all');
  const [timeFilter,    setTimeFilter]    = useState('all');
  const [province,      setProvince]      = useState('all');
  const [showAllCats,   setShowAllCats]   = useState(false);

  const mapRef  = useRef(null);
  const listRef = useRef(null);
  const { data: externalEvents } = useExternalEvents();

  useEffect(() => {
    const unsub = subscribeToEvents(newEvents => {
      setEvents(newEvents.filter(e => e.location?.lat && e.location?.lng && !e.isVirtual));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Filtrado ───────────────────────────────────────────────────────────────

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const filteredNative = useMemo(() => {
    let f = events.filter(e => { const d = parseDate(e.date); return !d || d >= today; });
    if (query.trim()) {
      const q = query.toLowerCase();
      f = f.filter(e => e.title?.toLowerCase().includes(q) || e.location?.name?.toLowerCase().includes(q));
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
      f = f.filter(e => e.title?.toLowerCase().includes(q) || e.locationText?.toLowerCase().includes(q));
    }
    return f;
  }, [externalEvents, query, today]);

  useEffect(() => { setVisibleEvents(filteredNative); }, [filteredNative]);

  const allEvents = useMemo(() =>
    [...filteredNative, ...filteredExternal].sort((a, b) => getTs(a) - getTs(b)),
  [filteredNative, filteredExternal]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (category !== 'all') n++;
    if (timeFilter !== 'all') n++;
    if (province !== 'all') n++;
    return n;
  }, [category, timeFilter, province]);

  // ── Interacciones de mapa ──────────────────────────────────────────────────

  const handleMarkerPress = useCallback((ev) => {
    setSelectedEvent(ev);
    mapRef.current?.animateToRegion({
      latitude: ev.location.lat, longitude: ev.location.lng,
      latitudeDelta: 0.02, longitudeDelta: 0.02,
    }, 300);
  }, []);

  const onRegionChangeComplete = useCallback((region) => {
    setMapRegion(region);
    setVisibleEvents(filteredNative.filter(e =>
      e.location.lat >= region.latitude  - region.latitudeDelta  / 2 &&
      e.location.lat <= region.latitude  + region.latitudeDelta  / 2 &&
      e.location.lng >= region.longitude - region.longitudeDelta / 2 &&
      e.location.lng <= region.longitude + region.longitudeDelta / 2
    ));
  }, [filteredNative]);

  const handleCardPress = useCallback((event) => {
    if (event._isExternal) navigation.navigate('ExternalEventDetail', { event });
    else navigation.navigate('EventDetail', { event });
  }, [navigation]);

  // ── Renders de lista ───────────────────────────────────────────────────────

  const renderListItem = useCallback(({ item }) => {
    if (item._isAd) return <NativeAdCard />;
    return <EventRow event={item} trailing="auto" onPress={() => handleCardPress(item)} />;
  }, [handleCardPress]);

  const listDataWithAds = useMemo(() => {
    const result = [];
    allEvents.forEach((ev, i) => {
      result.push(ev);
      if ((i + 1) % 6 === 0 && i >= 3) result.push({ _isAd: true, id: `ad_${i}` });
    });
    return result;
  }, [allEvents]);

  // ─────────────────────────────────────────────────────────────────────────

  const displayedCats = showAllCats ? CATEGORIES : CATEGORIES.slice(0, 8);
  const isSearching = query.trim().length > 0 || category !== 'all' || timeFilter !== 'all' || province !== 'all';

  return (
    <View style={[styles.screen, { backgroundColor: colors['bg.base'], paddingTop: insets.top }]}>

      {/* ── ENCABEZADO EDITORIAL (solo en lista sin búsqueda activa) ─────── */}
      {viewMode === 'list' && !isSearching && (
        <Text style={[styles.editorial, { color: colors['text.primary'], fontFamily: 'BricolageGrotesque_700Bold' }]}>
          {'Explorá lo que\npasa en Costa Rica'}
        </Text>
      )}

      {/* ── FILA DE BÚSQUEDA: campo + filtros (solo 2 elementos) ────────── */}
      <View style={styles.searchRow}>
        <View style={[styles.searchField, { backgroundColor: colors['bg.surface'], borderColor: colors['border.subtle'] }]}>
          <Ionicons name="search-outline" size={18} color={colors['text.tertiary']} />
          <TextInput
            style={[styles.searchInput, { color: colors['text.primary'], fontFamily: 'PlusJakartaSans_400Regular' }]}
            placeholder="Buscar eventos, lugares…"
            placeholderTextColor={colors['text.tertiary']}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} accessibilityLabel="Limpiar búsqueda">
              <Ionicons name="close-circle" size={18} color={colors['text.tertiary']} />
            </Pressable>
          )}
        </View>

        {/* Botón filtros — badge si hay filtros activos */}
        <Pressable
          onPress={() => setShowFilters(true)}
          style={[
            styles.filterBtn,
            { backgroundColor: activeFilterCount > 0 ? colors['action.primary'] : colors['bg.surface'] },
          ]}
          accessibilityLabel="Filtros"
          accessibilityRole="button"
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={activeFilterCount > 0 ? colors['text.onAction'] : colors['text.secondary']}
          />
          {activeFilterCount > 0 && (
            <View style={[styles.filterBadge, { backgroundColor: colors['status.urgent'], borderColor: colors['bg.base'] }]}>
              <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff' }}>
                {activeFilterCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* ── SEGMENTED CON TEXTO "Lista | Mapa" ──────────────────────────── */}
      <View style={[styles.segRow, { flexShrink: 0 }]}>
        {[
          { value: 'list', icon: 'list-outline',    label: 'Lista' },
          { value: 'map',  icon: 'map-outline',     label: 'Mapa'  },
        ].map(opt => {
          const active = viewMode === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setViewMode(opt.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[
                styles.segItem,
                { backgroundColor: active ? colors['bg.raised'] : 'transparent' },
              ]}
            >
              <Ionicons name={opt.icon} size={16} color={active ? colors['text.primary'] : colors['text.tertiary']} />
              <Text style={{
                fontSize: 14,
                fontFamily: active ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium',
                color: active ? colors['text.primary'] : colors['text.tertiary'],
              }}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── CONTENIDO ─────────────────────────────────────────────────────── */}
      {loading ? (
        <SkeletonList count={5} />
      ) : viewMode === 'list' ? (

        /* ── VISTA LISTA ───────────────────────────────────────────────── */
        <FlatList
          data={isSearching ? listDataWithAds : allEvents.slice(0, 10)}
          keyExtractor={(item, i) => item.id ?? `i_${i}`}
          renderItem={renderListItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + space[12] }}
          ListHeaderComponent={!isSearching ? (
            <View>
              {/* Grilla de categorías */}
              <View style={styles.sectionHeader}>
                <Text variant="h3">Categorías</Text>
              </View>
              <CategoryGrid
                onSelect={id => setCategory(id)}
                colors={colors}
                showAll={showAllCats}
                onToggleAll={() => setShowAllCats(true)}
              />
              {/* Sección "Cerca de vos" */}
              <View style={styles.sectionHeader}>
                <Text variant="h3">Cerca de vos</Text>
                <Pressable onPress={() => {}} accessibilityRole="button">
                  <Text variant="label" color="link">Ver todo</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          ListEmptyComponent={
            <EmptyState
              icon={<Ionicons name="search-outline" size={28} color={colors['text.tertiary']} />}
              title="Sin resultados"
              description={query ? `No hay eventos para "${query}"` : 'Probá con otros filtros'}
              actionLabel="Limpiar filtros"
              onAction={() => { setQuery(''); setCategory('all'); setTimeFilter('all'); setProvince('all'); }}
            />
          }
        />

      ) : (

        /* ── VISTA MAPA ────────────────────────────────────────────────── */
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={mapRegion}
            onRegionChangeComplete={onRegionChangeComplete}
            customMapStyle={DARK_MAP_STYLE}
            showsUserLocation
            showsMyLocationButton={false}
          >
            {filteredNative.map(ev => (
              <Marker
                key={ev.id}
                coordinate={{ latitude: ev.location.lat, longitude: ev.location.lng }}
                onPress={() => handleMarkerPress(ev)}
              >
                <PricePin event={ev} selected={selectedEvent?.id === ev.id} colors={colors} />
              </Marker>
            ))}
          </MapView>

          {/* FAB — centrar */}
          <Pressable
            style={[styles.fab, { backgroundColor: colors['bg.raised'], top: space[3] + insets.top }]}
            onPress={() => { mapRef.current?.animateToRegion(COSTA_RICA, 500); setSelectedEvent(null); }}
            accessibilityLabel="Centrar mapa"
          >
            <Ionicons name="locate-outline" size={22} color={colors['nav.selected']} />
          </Pressable>

          {/* Bottom sheet peek — resultados sobre el mapa */}
          <View style={[styles.mapSheet, { backgroundColor: colors['bg.raised'], paddingBottom: insets.bottom + space[3] }]}>
            {/* Handle */}
            <View style={[styles.mapSheetHandle, { backgroundColor: colors['border.strong'] }]} />

            {/* Contador */}
            <View style={styles.mapSheetHeader}>
              <Text variant="title">
                {visibleEvents.length === 0
                  ? 'Sin eventos en esta zona'
                  : `${visibleEvents.length} ${visibleEvents.length === 1 ? 'evento' : 'eventos'} en esta zona`}
              </Text>
              {visibleEvents.length === 0 && (
                <Pressable onPress={() => mapRef.current?.animateToRegion(COSTA_RICA, 500)}>
                  <Text variant="label" color="link">Ampliar</Text>
                </Pressable>
              )}
            </View>

            {/* Lista horizontal — § 3.3: paddingHorizontal + peek de la siguiente card */}
            {visibleEvents.length > 0 && (
              <FlatList
                ref={listRef}
                data={visibleEvents.slice(0, 15)}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_W + space[3]}
                snapToAlignment="start"
                decelerationRate="fast"
                contentContainerStyle={{ paddingHorizontal: space[5], gap: space[3] }}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => handleCardPress(item)}
                    style={[styles.mapCard, {
                      backgroundColor: colors['bg.surface'],
                      borderWidth: selectedEvent?.id === item.id ? 2 : 0,
                      borderColor: colors['action.primary'],
                    }]}
                  >
                    <Text variant="caption" color="text.tertiary" numberOfLines={1}>
                      {item.category?.toLocaleUpperCase('es-CR')}
                    </Text>
                    <Text variant="title" numberOfLines={2} style={{ marginVertical: 4 }}>{item.title}</Text>
                    {item.location?.name && (
                      <Text variant="caption" color="text.tertiary" numberOfLines={1}>{item.location.name}</Text>
                    )}
                  </Pressable>
                )}
              />
            )}
          </View>
        </View>
      )}

      {/* ── SHEET DE FILTROS ─────────────────────────────────────────────── */}
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
                if (p.id !== 'all' && viewMode === 'map') {
                  mapRef.current?.animateToRegion({ latitude: p.lat, longitude: p.lng, latitudeDelta: 0.3, longitudeDelta: 0.3 }, 500);
                }
              }} />
            ))}
          </View>

          <View style={styles.filterActions}>
            <Button variant="ghost" size="sm" label="Limpiar" onPress={() => { setTimeFilter('all'); setProvince('all'); setCategory('all'); setShowFilters(false); }} />
            <Button variant="primary" size="md" label={`Aplicar${activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}`} onPress={() => setShowFilters(false)} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </Sheet>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },

  editorial: {
    fontSize: 28,
    lineHeight: 34,
    paddingHorizontal: space[5],
    paddingTop: space[2],
    paddingBottom: space[3],
  },

  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: space[5],
    paddingBottom: space[3],
    gap: space[2],
    flexShrink: 0,
  },
  searchField: {
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[3],
    gap: space[2],
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  filterBtn: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
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

  // SegmentedControl con texto
  segRow: {
    flexDirection: 'row',
    marginHorizontal: space[5],
    marginBottom: space[3],
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.07)',
    padding: 3,
    gap: 2,
    flexGrow: 0,
  },
  segItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: radius.sm,
    gap: space[1],
  },

  // Categorías
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingTop: space[4],
    paddingBottom: space[3],
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: space[5],
    gap: space[2],
  },
  // § 3.1: fila (icono a la izquierda, texto a la derecha), 74px alto
  catCell: {
    height: 74,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[3],
    gap: space[3],
  },
  catIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  seeAllCats: {
    alignSelf: 'center',
    paddingVertical: space[3],
    paddingHorizontal: space[5],
  },
  seeAll: {
    alignSelf: 'center',
    paddingVertical: space[3],
    paddingHorizontal: space[5],
  },

  // Pines de mapa — § 3.4: oscuro para precio, verde para gratis
  pin: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  // § 3.4: seleccionado escala 1.12 + borde action.primary
  pinSelected: {
    transform: [{ scale: 1.12 }],
  },

  // FAB
  fab: {
    position: 'absolute',
    right: space[4],
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },

  // Bottom sheet del mapa
  mapSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  mapSheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: space[3],
    marginBottom: space[2],
  },
  mapSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingBottom: space[3],
  },
  mapCard: {
    width: CARD_W * 0.65,
    padding: space[3],
    borderRadius: radius.lg,
    borderWidth: 2,
    marginBottom: space[3],
  },

  // Filtros sheet
  filtersContent: { padding: space[5], gap: space[2] },
  filterChips:    { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  filterActions:  { flexDirection: 'row', gap: space[3], marginTop: space[6] },
});

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, FlatList, Image, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SearchListSkeleton } from '../components/SkeletonLoader';
import { subscribeToEvents } from '../services/eventService';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.75;
const CARD_HEIGHT = 200;

// Categorías estándar
const CATEGORIES = [
  { id: 'all', label: 'Todos', icon: 'apps' },
  { id: 'Música', label: 'Música', icon: 'musical-notes' },
  { id: 'Deportes', label: 'Deportes', icon: 'football' },
  { id: 'Arte', label: 'Arte', icon: 'color-palette' },
  { id: 'Tecnología', label: 'Tech', icon: 'laptop' },
  { id: 'Comida', label: 'Comida', icon: 'restaurant' },
  { id: 'Fiesta', label: 'Fiesta', icon: 'beer' },
  { id: 'Networking', label: 'Network', icon: 'people' },
  { id: 'Educación', label: 'Edu', icon: 'school' },
  { id: 'Cine', label: 'Cine', icon: 'film' },
  { id: 'Teatro', label: 'Teatro', icon: 'mic' },
  { id: 'Salud', label: 'Salud', icon: 'fitness' },
  { id: 'Naturaleza', label: 'Natura', icon: 'leaf' },
  { id: 'Otro', label: 'Otro', icon: 'ellipsis-horizontal' },
];

// Filtros de tiempo
const TIME_FILTERS = [
  { id: 'all', label: 'Cualquier fecha' },
  { id: 'today', label: 'Hoy' },
  { id: 'tomorrow', label: 'Mañana' },
  { id: 'week', label: 'Esta semana' },
  { id: 'month', label: 'Este mes' },
];

// Provincias de Costa Rica
const PROVINCES = [
  { id: 'all', label: 'Todas', lat: 9.9281, lng: -84.0907 },
  { id: 'San José', label: 'San José', lat: 9.9281, lng: -84.0907 },
  { id: 'Alajuela', label: 'Alajuela', lat: 10.0162, lng: -84.2115 },
  { id: 'Cartago', label: 'Cartago', lat: 9.8644, lng: -83.9194 },
  { id: 'Heredia', label: 'Heredia', lat: 10.0024, lng: -84.1165 },
  { id: 'Guanacaste', label: 'Guanacaste', lat: 10.4274, lng: -85.4520 },
  { id: 'Puntarenas', label: 'Puntarenas', lat: 9.9762, lng: -84.8382 },
  { id: 'Limón', label: 'Limón', lat: 9.9907, lng: -83.0359 },
];

const COSTA_RICA_REGION = {
  latitude: 9.9281,
  longitude: -84.0907,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

export default function SearchScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [visibleEvents, setVisibleEvents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTime, setSelectedTime] = useState('all');
  const [selectedProvince, setSelectedProvince] = useState('all');
  const [viewMode, setViewMode] = useState('map');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [mapRegion, setMapRegion] = useState(COSTA_RICA_REGION);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const mapRef = useRef(null);
  const flatListRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsubscribe = subscribeToEvents((newEvents) => {
      const eventsWithLocation = newEvents.filter(e => 
        e.location?.lat && e.location?.lng && 
        e.location.lat !== 0 && e.location.lng !== 0 &&
        !e.isVirtual
      );
      setEvents(eventsWithLocation);
      setFilteredEvents(eventsWithLocation);
      setVisibleEvents(eventsWithLocation);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    filterEvents();
  }, [searchQuery, selectedCategory, selectedTime, selectedProvince, events]);

  const parseDate = (dateString) => {
    if (!dateString) return null;
    const parts = dateString.split('/');
    if (parts.length === 3) {
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return null;
  };

  const isInTimeRange = (eventDate, filter) => {
    const date = parseDate(eventDate);
    if (!date) return true;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
    
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    switch (filter) {
      case 'today':
        return date.toDateString() === today.toDateString();
      case 'tomorrow':
        return date.toDateString() === tomorrow.toDateString();
      case 'week':
        return date >= today && date <= endOfWeek;
      case 'month':
        return date >= today && date <= endOfMonth;
      default:
        return true;
    }
  };

  const filterEvents = () => {
    let filtered = [...events];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        e.title?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.location?.name?.toLowerCase().includes(q) ||
        e.organizerName?.toLowerCase().includes(q)
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(e => e.category === selectedCategory);
    }

    if (selectedTime !== 'all') {
      filtered = filtered.filter(e => isInTimeRange(e.date, selectedTime));
    }

    if (selectedProvince !== 'all') {
      const province = PROVINCES.find(p => p.id === selectedProvince);
      if (province) {
        filtered = filtered.filter(e => {
          const distance = Math.sqrt(
            Math.pow(e.location.lat - province.lat, 2) + 
            Math.pow(e.location.lng - province.lng, 2)
          );
          return distance < 0.5;
        });
      }
    }

    setFilteredEvents(filtered);
    setVisibleEvents(filtered);
  };

  const onRegionChangeComplete = (region) => {
    setMapRegion(region);
    
    const visible = filteredEvents.filter(e => {
      const latInRange = e.location.lat >= region.latitude - region.latitudeDelta / 2 &&
                         e.location.lat <= region.latitude + region.latitudeDelta / 2;
      const lngInRange = e.location.lng >= region.longitude - region.longitudeDelta / 2 &&
                         e.location.lng <= region.longitude + region.longitudeDelta / 2;
      return latInRange && lngInRange;
    });
    
    setVisibleEvents(visible);
  };

  const handleMarkerPress = (event, index) => {
    setSelectedEvent(event);
    
    mapRef.current?.animateToRegion({
      latitude: event.location.lat,
      longitude: event.location.lng,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }, 300);

    const visibleIndex = visibleEvents.findIndex(e => e.id === event.id);
    if (visibleIndex >= 0) {
      flatListRef.current?.scrollToIndex({ index: visibleIndex, animated: true });
    }
  };

  const handleCardPress = (event) => {
    navigation.navigate('EventDetail', { event });
  };

  const onScrollEnd = (e) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + 10));
    if (visibleEvents[index]) {
      const event = visibleEvents[index];
      setSelectedEvent(event);
      mapRef.current?.animateToRegion({
        latitude: event.location.lat,
        longitude: event.location.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 300);
    }
  };

  const handleProvinceSelect = (province) => {
    setSelectedProvince(province.id);
    if (province.id !== 'all') {
      mapRef.current?.animateToRegion({
        latitude: province.lat,
        longitude: province.lng,
        latitudeDelta: 0.3,
        longitudeDelta: 0.3,
      }, 500);
    }
    setShowFilters(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return `${parts[0]} ${months[parseInt(parts[1]) - 1]}`;
    }
    return dateString;
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (selectedCategory !== 'all') count++;
    if (selectedTime !== 'all') count++;
    if (selectedProvince !== 'all') count++;
    return count;
  };

  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.categoryItem, selectedCategory === item.id && styles.categoryItemActive]}
      onPress={() => setSelectedCategory(item.id)}
    >
      <Ionicons 
        name={item.icon} 
        size={18} 
        color={selectedCategory === item.id ? '#fff' : '#888'} 
      />
      <Text style={[styles.categoryText, selectedCategory === item.id && styles.categoryTextActive]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  const renderEventCard = ({ item }) => (
    <TouchableOpacity 
      style={[styles.eventCard, selectedEvent?.id === item.id && styles.eventCardSelected]}
      onPress={() => handleCardPress(item)}
      activeOpacity={0.9}
    >
      <Image source={{ uri: item.image || 'https://via.placeholder.com/300x150' }} style={styles.eventImage} />
      <View style={styles.eventInfo}>
        <View style={styles.eventHeader}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{item.category}</Text>
          </View>
          {item.isFree ? (
            <Text style={styles.freeTag}>Gratis</Text>
          ) : (
            <Text style={styles.priceTag}>₡{item.price}</Text>
          )}
        </View>
        <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>
        <View style={styles.eventDetails}>
          <View style={styles.eventDetailRow}>
            <Ionicons name="calendar-outline" size={12} color="#888" />
            <Text style={styles.eventDetailText}>{formatDate(item.date)} - {item.time}</Text>
          </View>
          <View style={styles.eventDetailRow}>
            <Ionicons name="location-outline" size={12} color="#888" />
            <Text style={styles.eventDetailText} numberOfLines={1}>{item.location?.name}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderListEventCard = ({ item }) => (
    <TouchableOpacity style={styles.listCard} onPress={() => handleCardPress(item)}>
      <Image source={{ uri: item.image || 'https://via.placeholder.com/300x150' }} style={styles.listCardImage} />
      <View style={styles.listCardInfo}>
        <View style={styles.listCardHeader}>
          <View style={styles.categoryBadgeSmall}>
            <Text style={styles.categoryBadgeTextSmall}>{item.category}</Text>
          </View>
          {item.isFree ? (
            <Text style={styles.freeTagSmall}>Gratis</Text>
          ) : (
            <Text style={styles.priceTagSmall}>₡{item.price}</Text>
          )}
        </View>
        <Text style={styles.listCardTitle} numberOfLines={2}>{item.title}</Text>
        <View style={styles.listCardDetails}>
          <Ionicons name="calendar-outline" size={12} color="#888" />
          <Text style={styles.listCardDetailText}>{formatDate(item.date)} - {item.time}</Text>
        </View>
        <View style={styles.listCardDetails}>
          <Ionicons name="location-outline" size={12} color="#888" />
          <Text style={styles.listCardDetailText} numberOfLines={1}>{item.location?.name}</Text>
        </View>
        <View style={styles.listCardStats}>
          <View style={styles.statItem}>
            <Ionicons name="heart" size={12} color="#e74c3c" />
            <Text style={styles.statText}>{item.likes?.length || 0}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="people" size={12} color="#00b894" />
            <Text style={styles.statText}>{item.attendees?.length || 0}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const CustomMarker = ({ event, isSelected }) => {
    const priceText = event.isFree ? 'Gratis' : `₡${event.price}`;
    return (
      <View style={{
        backgroundColor: isSelected ? '#6c5ce7' : '#fff',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: Platform.OS === 'ios' ? 16 : 4,
        borderWidth: Platform.OS === 'ios' ? 2 : 1,
        borderColor: isSelected ? '#6c5ce7' : '#333',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      }}>
        <Text style={{
          color: isSelected ? '#fff' : '#1a1a2e',
          fontWeight: 'bold',
          fontSize: Platform.OS === 'ios' ? 12 : 10,
          includeFontPadding: false,
          textAlign: 'center',
        }}>{priceText}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header con búsqueda */}
      <View style={styles.searchHeader}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar eventos..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#888" />
            </TouchableOpacity>
          )}
        </View>
        
        <TouchableOpacity 
          style={[styles.filterButton, getActiveFiltersCount() > 0 && styles.filterButtonActive]}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="options" size={20} color={getActiveFiltersCount() > 0 ? '#fff' : '#888'} />
          {getActiveFiltersCount() > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{getActiveFiltersCount()}</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.viewToggle}>
          <TouchableOpacity 
            style={[styles.toggleButton, viewMode === 'map' && styles.toggleButtonActive]}
            onPress={() => setViewMode('map')}
          >
            <Ionicons name="map" size={18} color={viewMode === 'map' ? '#fff' : '#888'} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons name="list" size={18} color={viewMode === 'list' ? '#fff' : '#888'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Categorías horizontales */}
      <View style={styles.categoriesContainer}>
        <FlatList
          data={CATEGORIES}
          keyExtractor={(item) => item.id}
          renderItem={renderCategoryItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
        />
      </View>

      {/* Filtros rápidos de tiempo */}
      <View style={styles.timeFiltersContainer}>
        <FlatList
          data={TIME_FILTERS}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.timeFilter, selectedTime === item.id && styles.timeFilterActive]}
              onPress={() => setSelectedTime(item.id)}
            >
              <Text style={[styles.timeFilterText, selectedTime === item.id && styles.timeFilterTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.timeFiltersList}
        />
      </View>

      {/* Contador de resultados */}
      <View style={styles.resultsCount}>
        <Text style={styles.resultsText}>
          {viewMode === 'map' ? visibleEvents.length : filteredEvents.length} eventos 
          {selectedProvince !== 'all' && ` en ${selectedProvince}`}
        </Text>
      </View>

      {viewMode === 'map' ? (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={mapRegion}
            onRegionChangeComplete={onRegionChangeComplete}
            showsUserLocation={true}
            showsMyLocationButton={false}
          >
            {filteredEvents.map((event, index) => {
              const isSelected = selectedEvent?.id === event.id;
              const categoryColors = {
                'Música': '#e74c3c',
                'Deportes': '#00b894',
                'Arte': '#fdcb6e',
                'Tecnología': '#0984e3',
                'Comida': '#e17055',
                'Fiesta': '#6c5ce7',
                'Networking': '#00cec9',
                'Educación': '#a29bfe',
                'Cine': '#fd79a8',
                'Teatro': '#e84393',
                'Salud': '#55efc4',
                'Naturaleza': '#00b894',
              };
              const pinColor = isSelected ? '#6c5ce7' : (categoryColors[event.category] || '#e74c3c');
              
              if (Platform.OS === 'android') {
                return (
                  <Marker
                    key={event.id}
                    coordinate={{
                      latitude: event.location.lat,
                      longitude: event.location.lng,
                    }}
                    onPress={() => handleMarkerPress(event, index)}
                    pinColor={pinColor}
                  />
                );
              }
              
              return (
                <Marker
                  key={event.id}
                  coordinate={{
                    latitude: event.location.lat,
                    longitude: event.location.lng,
                  }}
                  onPress={() => handleMarkerPress(event, index)}
                >
                  <CustomMarker event={event} isSelected={isSelected} />
                </Marker>
              );
            })}
          </MapView>

          {visibleEvents.length > 0 && (
            <Animated.FlatList
              ref={flatListRef}
              data={visibleEvents}
              keyExtractor={(item) => item.id}
              renderItem={renderEventCard}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + 10}
              snapToAlignment="center"
              decelerationRate="fast"
              contentContainerStyle={styles.carouselContainer}
              onMomentumScrollEnd={onScrollEnd}
              getItemLayout={(data, index) => ({
                length: CARD_WIDTH + 10,
                offset: (CARD_WIDTH + 10) * index,
                index,
              })}
            />
          )}

          <TouchableOpacity 
            style={styles.myLocationButton}
            onPress={() => mapRef.current?.animateToRegion(COSTA_RICA_REGION, 500)}
          >
            <Ionicons name="locate" size={24} color="#6c5ce7" />
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <SearchListSkeleton count={5} />
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          renderItem={renderListEventCard}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={60} color="#888" />
              <Text style={styles.emptyTitle}>No se encontraron eventos</Text>
              <Text style={styles.emptyText}>Intenta con otros filtros</Text>
            </View>
          }
        />
      )}

      {/* Modal de filtros avanzados */}
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtros</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterSectionTitle}>Provincia</Text>
            <View style={styles.provinceGrid}>
              {PROVINCES.map((province) => (
                <TouchableOpacity
                  key={province.id}
                  style={[
                    styles.provinceItem,
                    selectedProvince === province.id && styles.provinceItemActive
                  ]}
                  onPress={() => handleProvinceSelect(province)}
                >
                  <Text style={[
                    styles.provinceText,
                    selectedProvince === province.id && styles.provinceTextActive
                  ]}>
                    {province.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              style={styles.clearButton}
              onPress={() => {
                setSelectedCategory('all');
                setSelectedTime('all');
                setSelectedProvince('all');
                setShowFilters(false);
              }}
            >
              <Text style={styles.clearButtonText}>Limpiar filtros</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  searchHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 10, gap: 8 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#2d2d44', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, marginLeft: 8 },
  filterButton: { backgroundColor: '#2d2d44', borderRadius: 10, padding: 10, position: 'relative' },
  filterButtonActive: { backgroundColor: '#6c5ce7' },
  filterBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#e74c3c', borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  filterBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  viewToggle: { flexDirection: 'row', backgroundColor: '#2d2d44', borderRadius: 10, padding: 3 },
  toggleButton: { padding: 7, borderRadius: 7 },
  toggleButtonActive: { backgroundColor: '#6c5ce7' },
  categoriesContainer: { borderBottomWidth: 1, borderBottomColor: '#2d2d44' },
  categoriesList: { paddingHorizontal: 15, paddingVertical: 10 },
  categoryItem: { flexDirection: 'row', alignItems: 'center', marginRight: 12, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#2d2d44', gap: 6 },
  categoryItemActive: { backgroundColor: '#6c5ce7' },
  categoryText: { color: '#888', fontSize: 12 },
  categoryTextActive: { color: '#fff' },
  timeFiltersContainer: { borderBottomWidth: 1, borderBottomColor: '#2d2d44' },
  timeFiltersList: { paddingHorizontal: 15, paddingVertical: 8 },
  timeFilter: { marginRight: 10, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 15, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#3d3d5c' },
  timeFilterActive: { backgroundColor: '#6c5ce7', borderColor: '#6c5ce7' },
  timeFilterText: { color: '#888', fontSize: 12 },
  timeFilterTextActive: { color: '#fff' },
  resultsCount: { paddingHorizontal: 15, paddingVertical: 6 },
  resultsText: { color: '#888', fontSize: 12 },
  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  carouselContainer: { position: 'absolute', bottom: 15, paddingHorizontal: 15 },
  eventCard: { width: CARD_WIDTH, height: CARD_HEIGHT, backgroundColor: '#2d2d44', borderRadius: 14, marginRight: 10, overflow: 'hidden', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  eventCardSelected: { borderWidth: 2, borderColor: '#6c5ce7' },
  eventImage: { width: '100%', height: 100, backgroundColor: '#3d3d5c' },
  eventInfo: { padding: 12, flex: 1, justifyContent: 'space-between' },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  categoryBadge: { backgroundColor: '#6c5ce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  categoryBadgeText: { color: '#fff', fontSize: 9, fontWeight: '600' },
  freeTag: { color: '#00b894', fontSize: 11, fontWeight: 'bold' },
  priceTag: { color: '#fdcb6e', fontSize: 11, fontWeight: 'bold' },
  eventTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginBottom: 6 },
  eventDetails: { flex: 1, justifyContent: 'flex-end' },
  eventDetailRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  eventDetailText: { color: '#aaa', fontSize: 11, marginLeft: 5, flex: 1 },
  myLocationButton: { position: 'absolute', top: 15, right: 15, backgroundColor: '#fff', width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  listContainer: { paddingHorizontal: 15, paddingBottom: 20 },
  listCard: { flexDirection: 'row', backgroundColor: '#2d2d44', borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  listCardImage: { width: 100, height: 120, backgroundColor: '#3d3d5c' },
  listCardInfo: { flex: 1, padding: 12 },
  listCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  categoryBadgeSmall: { backgroundColor: '#6c5ce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  categoryBadgeTextSmall: { color: '#fff', fontSize: 9, fontWeight: '600' },
  freeTagSmall: { color: '#00b894', fontSize: 11, fontWeight: 'bold' },
  priceTagSmall: { color: '#fdcb6e', fontSize: 11, fontWeight: 'bold' },
  listCardTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 6 },
  listCardDetails: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  listCardDetailText: { color: '#888', fontSize: 11, marginLeft: 4, flex: 1 },
  listCardStats: { flexDirection: 'row', marginTop: 8 },
  statItem: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  statText: { color: '#888', fontSize: 11, marginLeft: 3 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 15 },
  emptyText: { color: '#888', fontSize: 14, marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  filterSectionTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12, marginTop: 10 },
  provinceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  provinceItem: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#2d2d44', marginBottom: 5 },
  provinceItemActive: { backgroundColor: '#6c5ce7' },
  provinceText: { color: '#888', fontSize: 14 },
  provinceTextActive: { color: '#fff' },
  clearButton: { marginTop: 25, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#6c5ce7', alignItems: 'center' },
  clearButtonText: { color: '#6c5ce7', fontSize: 15, fontWeight: '600' },
});
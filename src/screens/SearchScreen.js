import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, FlatList, Image, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { subscribeToEvents } from '../services/eventService';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.85;
const CARD_HEIGHT = 220;

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState('map');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [mapRegion, setMapRegion] = useState(COSTA_RICA_REGION);
  
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
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    filterEvents();
  }, [searchQuery, selectedCategory, events]);

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

    setFilteredEvents(filtered);
  };

  const handleMarkerPress = (event, index) => {
    setSelectedEvent(event);
    
    mapRef.current?.animateToRegion({
      latitude: event.location.lat,
      longitude: event.location.lng,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }, 300);

    flatListRef.current?.scrollToIndex({ index, animated: true });
  };

  const handleCardPress = (event) => {
    navigation.navigate('EventDetail', { event });
  };

  const onScrollEnd = (e) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
    if (filteredEvents[index]) {
      const event = filteredEvents[index];
      setSelectedEvent(event);
      mapRef.current?.animateToRegion({
        latitude: event.location.lat,
        longitude: event.location.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 300);
    }
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

  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.categoryItem, selectedCategory === item.id && styles.categoryItemActive]}
      onPress={() => setSelectedCategory(item.id)}
    >
      <Ionicons 
        name={item.icon} 
        size={20} 
        color={selectedCategory === item.id ? '#fff' : '#888'} 
      />
      <Text style={[styles.categoryText, selectedCategory === item.id && styles.categoryTextActive]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  const renderEventCard = ({ item, index }) => (
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
            <Ionicons name="calendar-outline" size={14} color="#888" />
            <Text style={styles.eventDetailText}>{formatDate(item.date)} - {item.time}</Text>
          </View>
          <View style={styles.eventDetailRow}>
            <Ionicons name="location-outline" size={14} color="#888" />
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
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: Platform.OS === 'ios' ? 20 : 4,
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
          fontSize: Platform.OS === 'ios' ? 14 : 12,
          includeFontPadding: false,
          textAlign: 'center',
        }}>{priceText}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchHeader}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar eventos, lugares..."
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

      <View style={styles.resultsCount}>
        <Text style={styles.resultsText}>{filteredEvents.length} eventos encontrados</Text>
      </View>

      {viewMode === 'map' ? (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={mapRegion}
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

          {filteredEvents.length > 0 && (
            <Animated.FlatList
              ref={flatListRef}
              data={filteredEvents}
              keyExtractor={(item) => item.id}
              renderItem={renderEventCard}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + 15}
              snapToAlignment="center"
              decelerationRate="fast"
              contentContainerStyle={styles.carouselContainer}
              onMomentumScrollEnd={onScrollEnd}
              getItemLayout={(data, index) => ({
                length: CARD_WIDTH + 15,
                offset: (CARD_WIDTH + 15) * index,
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
              <Text style={styles.emptyText}>Intenta con otra busqueda o categoria</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  searchHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 10 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#2d2d44', borderRadius: 12, paddingHorizontal: 15, paddingVertical: 12 },
  searchInput: { flex: 1, color: '#fff', fontSize: 16, marginLeft: 10 },
  viewToggle: { flexDirection: 'row', marginLeft: 10, backgroundColor: '#2d2d44', borderRadius: 10, padding: 4 },
  toggleButton: { padding: 8, borderRadius: 8 },
  toggleButtonActive: { backgroundColor: '#6c5ce7' },
  categoriesContainer: { borderBottomWidth: 1, borderBottomColor: '#2d2d44' },
  categoriesList: { paddingHorizontal: 15, paddingVertical: 12 },
  categoryItem: { alignItems: 'center', marginRight: 20, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20 },
  categoryItemActive: { backgroundColor: '#6c5ce7' },
  categoryText: { color: '#888', fontSize: 12, marginTop: 4 },
  categoryTextActive: { color: '#fff' },
  resultsCount: { paddingHorizontal: 15, paddingVertical: 8 },
  resultsText: { color: '#888', fontSize: 13 },
  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  carouselContainer: { position: 'absolute', bottom: 20, paddingHorizontal: (width - CARD_WIDTH) / 2 - 7.5 },
  eventCard: { width: CARD_WIDTH, height: CARD_HEIGHT, backgroundColor: '#2d2d44', borderRadius: 16, marginHorizontal: 7.5, overflow: 'hidden', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  eventCardSelected: { borderWidth: 2, borderColor: '#6c5ce7' },
  eventImage: { width: '100%', height: 110, backgroundColor: '#3d3d5c' },
  eventInfo: { padding: 14, flex: 1, justifyContent: 'space-between' },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  categoryBadge: { backgroundColor: '#6c5ce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  categoryBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  freeTag: { color: '#00b894', fontSize: 12, fontWeight: 'bold' },
  priceTag: { color: '#fdcb6e', fontSize: 12, fontWeight: 'bold' },
  eventTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  eventDetails: { flex: 1, justifyContent: 'flex-end' },
  eventDetailRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  eventDetailText: { color: '#aaa', fontSize: 12, marginLeft: 6, flex: 1 },
  myLocationButton: { position: 'absolute', top: 15, right: 15, backgroundColor: '#fff', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
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
});
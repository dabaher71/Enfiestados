import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  Image,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import MapView, { Marker } from 'react-native-maps';
import { createEvent } from '../services/eventService';
import { auth, storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const CATEGORIES = [
  { id: 'musica', name: 'Música', icon: 'musical-notes' },
  { id: 'fiesta', name: 'Fiesta', icon: 'beer' },
  { id: 'deporte', name: 'Deporte', icon: 'football' },
  { id: 'arte', name: 'Arte', icon: 'color-palette' },
  { id: 'tech', name: 'Tecnología', icon: 'laptop' },
  { id: 'comida', name: 'Comida', icon: 'restaurant' },
  { id: 'networking', name: 'Networking', icon: 'people' },
  { id: 'otro', name: 'Otro', icon: 'ellipsis-horizontal' },
];

export default function CreateEventScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [locationCoords, setLocationCoords] = useState(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState('');
  const [isVirtual, setIsVirtual] = useState(false);
  const [virtualLink, setVirtualLink] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [currentLocation, setCurrentLocation] = useState({
    latitude: 9.9281,
    longitude: -84.0907,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      }
    } catch (error) {
      console.log('Error obteniendo ubicación:', error);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tu cámara');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const showImageOptions = () => {
    Alert.alert('Agregar imagen', 'Selecciona una opción', [
      { text: 'Tomar foto', onPress: takePhoto },
      { text: 'Elegir de galería', onPress: pickImage },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const uploadImage = async (uri) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `events/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, blob);
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error('Error al subir imagen:', error);
      throw error;
    }
  };

  const formatDate = (date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatTime = (time) => {
    const hours = time.getHours().toString().padStart(2, '0');
    const minutes = time.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const onTimeChange = (event, selectedTime) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      setTime(selectedTime);
    }
  };

  const handleMapPress = (e) => {
    setLocationCoords(e.nativeEvent.coordinate);
  };

  const confirmLocation = () => {
    if (locationCoords) {
      setShowMapModal(false);
    } else {
      Alert.alert('Error', 'Por favor selecciona un punto en el mapa');
    }
  };

  const handleCreate = async () => {
    if (!title || !category) {
      Alert.alert('Error', 'Por favor completa los campos obligatorios');
      return;
    }

    if (!isVirtual && !locationCoords) {
      Alert.alert('Error', 'Por favor selecciona la ubicación en el mapa');
      return;
    }

    if (isVirtual && !virtualLink) {
      Alert.alert('Error', 'Por favor ingresa el link del evento virtual');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;

      let imageURL = '';
      if (image) {
        setUploadingImage(true);
        imageURL = await uploadImage(image);
        setUploadingImage(false);
      }

      await createEvent({
        title,
        description,
        category,
        date: formatDate(date),
        time: formatTime(time),
        location: {
          name: locationName,
          lat: locationCoords?.latitude || 0,
          lng: locationCoords?.longitude || 0,
        },
        isVirtual,
        virtualLink: isVirtual ? virtualLink : '',
        isFree,
        price: isFree ? 0 : parseFloat(price) || 0,
        organizerId: user.uid,
        organizerName: user.displayName || user.email.split('@')[0],
        organizerAvatar: user.photoURL || '',
        image: imageURL,
        capacity: 0,
        hasParking: false,
      });

      Alert.alert('¡Éxito!', 'Evento creado correctamente', [
        { text: 'OK', onPress: () => navigation.navigate('Home') }
      ]);

      // Limpiar formulario
      setTitle('');
      setDescription('');
      setCategory('');
      setDate(new Date());
      setTime(new Date());
      setLocationName('');
      setLocationCoords(null);
      setIsFree(true);
      setPrice('');
      setIsVirtual(false);
      setVirtualLink('');
      setImage(null);
    } catch (error) {
      Alert.alert('Error', 'No se pudo crear el evento');
      console.error(error);
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Crear Evento</Text>
        </View>

        <View style={styles.form}>
          {/* Imagen */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Imagen del evento</Text>
            <TouchableOpacity style={styles.imagePickerContainer} onPress={showImageOptions}>
              {image ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: image }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setImage(null)}
                  >
                    <Ionicons name="close-circle" size={28} color="#e74c3c" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="camera" size={40} color="#888" />
                  <Text style={styles.imagePlaceholderText}>Agregar imagen</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Título */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Título del evento *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Concierto de Jazz"
              placeholderTextColor="#888"
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Descripción */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Descripción</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe tu evento..."
              placeholderTextColor="#888"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Categoría */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Categoría *</Text>
            <View style={styles.categoriesGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryItem,
                    category === cat.id && styles.categoryItemActive
                  ]}
                  onPress={() => setCategory(cat.id)}
                >
                  <Ionicons
                    name={cat.icon}
                    size={24}
                    color={category === cat.id ? '#fff' : '#888'}
                  />
                  <Text style={[
                    styles.categoryText,
                    category === cat.id && styles.categoryTextActive
                  ]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Fecha y Hora */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.label}>Fecha *</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar" size={20} color="#6c5ce7" />
                <Text style={styles.dateButtonText}>{formatDate(date)}</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Hora *</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time" size={20} color="#6c5ce7" />
                <Text style={styles.dateButtonText}>{formatTime(time)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Date Picker */}
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onDateChange}
              minimumDate={new Date()}
            />
          )}

          {/* Time Picker */}
          {showTimePicker && (
            <DateTimePicker
              value={time}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onTimeChange}
            />
          )}

          {/* Virtual o Presencial */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tipo de evento</Text>
            <View style={styles.typeToggle}>
              <TouchableOpacity
                style={[styles.typeButton, !isVirtual && styles.typeButtonActive]}
                onPress={() => setIsVirtual(false)}
              >
                <Ionicons
                  name="location"
                  size={20}
                  color={!isVirtual ? '#fff' : '#888'}
                />
                <Text style={[styles.typeText, !isVirtual && styles.typeTextActive]}>
                  Presencial
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, isVirtual && styles.typeButtonActive]}
                onPress={() => setIsVirtual(true)}
              >
                <Ionicons
                  name="videocam"
                  size={20}
                  color={isVirtual ? '#fff' : '#888'}
                />
                <Text style={[styles.typeText, isVirtual && styles.typeTextActive]}>
                  Virtual
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Ubicación o Link Virtual */}
          {isVirtual ? (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Link del evento *</Text>
              <TextInput
                style={styles.input}
                placeholder="https://zoom.us/..."
                placeholderTextColor="#888"
                value={virtualLink}
                onChangeText={setVirtualLink}
                autoCapitalize="none"
              />
            </View>
          ) : (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nombre del lugar</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: Teatro Nacional"
                  placeholderTextColor="#888"
                  value={locationName}
                  onChangeText={setLocationName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Ubicación en el mapa *</Text>
                <TouchableOpacity
                  style={styles.mapButton}
                  onPress={() => setShowMapModal(true)}
                >
                  {locationCoords ? (
                    <View style={styles.mapPreview}>
                      <Ionicons name="checkmark-circle" size={24} color="#00b894" />
                      <Text style={styles.mapButtonTextSuccess}>
                        Ubicación seleccionada
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.mapPreview}>
                      <Ionicons name="map" size={24} color="#6c5ce7" />
                      <Text style={styles.mapButtonText}>
                        Seleccionar en el mapa
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Precio */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Precio</Text>
            <View style={styles.priceToggle}>
              <TouchableOpacity
                style={[styles.toggleButton, isFree && styles.toggleButtonActive]}
                onPress={() => setIsFree(true)}
              >
                <Text style={[styles.toggleText, isFree && styles.toggleTextActive]}>
                  Gratis
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, !isFree && styles.toggleButtonActive]}
                onPress={() => setIsFree(false)}
              >
                <Text style={[styles.toggleText, !isFree && styles.toggleTextActive]}>
                  De pago
                </Text>
              </TouchableOpacity>
            </View>
            {!isFree && (
              <TextInput
                style={[styles.input, { marginTop: 10 }]}
                placeholder="Precio en colones"
                placeholderTextColor="#888"
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
              />
            )}
          </View>

          {/* Botón Crear */}
          <TouchableOpacity
            style={[styles.createButton, loading && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.createButtonText}>
                  {uploadingImage ? 'Subiendo imagen...' : 'Creando...'}
                </Text>
              </View>
            ) : (
              <Text style={styles.createButtonText}>Crear Evento</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal del Mapa */}
      <Modal
        visible={showMapModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.mapModalContainer}>
          <View style={styles.mapHeader}>
            <TouchableOpacity onPress={() => setShowMapModal(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.mapHeaderTitle}>Seleccionar ubicación</Text>
            <TouchableOpacity onPress={confirmLocation}>
              <Text style={styles.mapConfirmText}>Listo</Text>
            </TouchableOpacity>
          </View>

          <MapView
            style={styles.map}
            initialRegion={currentLocation}
            onPress={handleMapPress}
          >
            {locationCoords && (
              <Marker coordinate={locationCoords}>
                <View style={styles.markerContainer}>
                  <Ionicons name="location" size={40} color="#6c5ce7" />
                </View>
              </Marker>
            )}
          </MapView>

          <View style={styles.mapFooter}>
            <Ionicons name="information-circle" size={20} color="#888" />
            <Text style={styles.mapFooterText}>
              Toca en el mapa para seleccionar la ubicación del evento
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 35) + 10 : 10,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  form: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  imagePickerContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3d3d5c',
    borderStyle: 'dashed',
  },
  imagePlaceholderText: {
    color: '#888',
    fontSize: 16,
    marginTop: 10,
  },
  imagePreviewContainer: {
    flex: 1,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  categoryItem: {
    width: '23%',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    margin: '1%',
  },
  categoryItemActive: {
    backgroundColor: '#6c5ce7',
  },
  categoryText: {
    color: '#888',
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  categoryTextActive: {
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
  },
  dateButton: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateButtonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  typeToggle: {
    flexDirection: 'row',
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderRadius: 12,
  },
  typeButtonActive: {
    backgroundColor: '#6c5ce7',
  },
  typeText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  typeTextActive: {
    color: '#fff',
  },
  mapButton: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 20,
  },
  mapPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapButtonText: {
    color: '#6c5ce7',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  mapButtonTextSuccess: {
    color: '#00b894',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  priceToggle: {
    flexDirection: 'row',
  },
  toggleButton: {
    flex: 1,
    backgroundColor: '#2d2d44',
    padding: 14,
    alignItems: 'center',
    marginRight: 10,
    borderRadius: 12,
  },
  toggleButtonActive: {
    backgroundColor: '#6c5ce7',
  },
  toggleText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#fff',
  },
  createButton: {
    backgroundColor: '#6c5ce7',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 20,
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapModalContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  mapHeaderTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  mapConfirmText: {
    color: '#6c5ce7',
    fontSize: 16,
    fontWeight: '600',
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    alignItems: 'center',
  },
  mapFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: '#2d2d44',
  },
  mapFooterText: {
    color: '#888',
    fontSize: 14,
    marginLeft: 8,
  },
});

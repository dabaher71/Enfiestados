import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import MapView, { Marker } from 'react-native-maps';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { validateImageSize, validateImageMime, isValidWebURL, INPUT_LIMITS } from '../utils/security';
import { CATEGORIES } from '../constants/categories';

export default function EditEventScreen({ route, navigation }) {
  const { event } = route.params;

  // Parsear fecha y hora del evento
  const parseDate = (dateStr) => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date();
  };

  const parseTime = (timeStr) => {
    if (!timeStr) return new Date();
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      const date = new Date();
      date.setHours(parseInt(parts[0]), parseInt(parts[1]));
      return date;
    }
    return new Date();
  };

  const [title, setTitle] = useState(event.title || '');
  const [description, setDescription] = useState(event.description || '');
  const [category, setCategory] = useState(event.category || '');
  const [date, setDate] = useState(parseDate(event.date));
  const [time, setTime] = useState(parseTime(event.time));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [locationName, setLocationName] = useState(event.location?.name || '');
  const [locationCoords, setLocationCoords] = useState(
    event.location?.lat && event.location?.lng
      ? { latitude: event.location.lat, longitude: event.location.lng }
      : null
  );
  const [showMapModal, setShowMapModal] = useState(false);
  const [isFree, setIsFree] = useState(event.isFree !== false);
  const [price, setPrice] = useState(event.price?.toString() || '');
  const [isVirtual, setIsVirtual] = useState(event.isVirtual || false);
  const [virtualLink, setVirtualLink] = useState(event.virtualLink || '');
  const [image, setImage] = useState(event.image || null);
  const [newImage, setNewImage] = useState(null);
  const [loading, setLoading] = useState(false);

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
      const asset = result.assets[0];
      if (!validateImageSize(asset)) {
        Alert.alert('Imagen demasiado grande', 'La imagen debe ser menor a 5MB');
        return;
      }
      setNewImage(asset.uri);
    }
  };

  const uploadImage = async (uri) => {
    const blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => resolve(xhr.response);
      xhr.onerror = () => reject(new Error('Error al leer imagen'));
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });
    if (!validateImageMime(blob)) {
      blob.close?.();
      throw new Error('Tipo de archivo no permitido. Solo se aceptan imágenes JPG, PNG, WebP o GIF.');
    }
    const filename = `events/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    const storageRef = ref(storage, filename);
    await uploadBytes(storageRef, blob, { contentType: blob.type });
    const url = await getDownloadURL(storageRef);
    blob.close?.();
    return url;
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

  const handleSave = async () => {
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

    if (isVirtual && virtualLink && !isValidWebURL(virtualLink)) {
      Alert.alert('Link inválido', 'El link debe comenzar con https://');
      return;
    }

    setLoading(true);
    try {
      let imageURL = image;

      // Subir nueva imagen si se cambió
      if (newImage) {
        imageURL = await uploadImage(newImage);
      }

      // Actualizar evento en Firestore
      await updateDoc(doc(db, 'events', event.id), {
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
        image: imageURL,
        updatedAt: new Date().toISOString(),
      });

      Alert.alert('¡Éxito!', 'Evento actualizado correctamente', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el evento');
      console.error(error);
    }
    setLoading(false);
  };

  const displayImage = newImage || image;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Editar Evento</Text>
          <TouchableOpacity onPress={handleSave} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#6c5ce7" />
            ) : (
              <Text style={styles.saveButton}>Guardar</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          {/* Imagen */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Imagen del evento</Text>
            <TouchableOpacity style={styles.imagePickerContainer} onPress={pickImage}>
              {displayImage ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: displayImage }} style={styles.imagePreview} />
                  <View style={styles.changeImageOverlay}>
                    <Ionicons name="camera" size={30} color="#fff" />
                    <Text style={styles.changeImageText}>Cambiar imagen</Text>
                  </View>
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
              maxLength={INPUT_LIMITS.EVENT_DESCRIPTION}
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

          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onDateChange}
            />
          )}

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
            initialRegion={{
              latitude: locationCoords?.latitude || 9.9281,
              longitude: locationCoords?.longitude || -84.0907,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  saveButton: {
    color: '#6c5ce7',
    fontSize: 16,
    fontWeight: '600',
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
  changeImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  changeImageText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
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

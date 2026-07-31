// EditEventScreen — Editar evento
// LÓGICA INTACTA: parseo de fecha/hora, imagen, ubicación, upload, updateDoc.
// PRESENTACIÓN: tokens del design system, mismos patrones que CreateEventScreen
// (chips de categoría, MetaRow-like pickers de fecha/hora sin duplicado, SegmentedControl, CTA amarillo).
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import MapView, { Marker } from 'react-native-maps';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../components/ui/Button';
import Input, { TextArea } from '../components/ui/Input';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import Text from '../components/ui/Text';

import { db, storage } from '../config/firebase';
import { validateImageSize, validateImageMime, isValidWebURL, INPUT_LIMITS } from '../utils/security';
import { CATEGORIES } from '../constants/categories';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';

// ─── Formateo de fecha/hora humano (igual que CreateEventScreen) ────────────

const DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function humanDate(d) {
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
function humanTime(t) {
  let h = t.getHours(), m = t.getMinutes();
  const mer = h >= 12 ? 'pm' : 'am';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, '0')} ${mer}`;
}
function storageDate(d) {
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}
function storageTime(t) {
  return `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`;
}

// Parsea 'DD/MM/YYYY' y 'HH:MM' del evento existente a Date
function parseDate(dateStr) {
  if (!dateStr) return new Date();
  const parts = dateStr.split('/');
  if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
  return new Date();
}
function parseTime(timeStr) {
  if (!timeStr) return new Date();
  const parts = timeStr.split(':');
  if (parts.length === 2) {
    const d = new Date();
    d.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10));
    return d;
  }
  return new Date();
}

// ─── Componentes inline ──────────────────────────────────────────────────────

function FieldLabel({ label, optional = false, colors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 }}>
      <Text style={{ fontSize: 14.5, fontFamily: 'PlusJakartaSans_700Bold', color: colors['text.secondary'] }}>
        {label}
      </Text>
      {optional && (
        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: colors['text.tertiary'] }}>
          · opcional
        </Text>
      )}
    </View>
  );
}

function Field({ children }) {
  return <View style={styles.fieldWrap}>{children}</View>;
}

// ─── EditEventScreen ──────────────────────────────────────────────────────────

export default function EditEventScreen({ route, navigation }) {
  const { event } = route.params;
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [title,           setTitle]          = useState(event.title || '');
  const [description,     setDescription]    = useState(event.description || '');
  const [category,        setCategory]       = useState(event.category || '');
  const [date,             setDate]          = useState(parseDate(event.date));
  const [time,             setTime]          = useState(parseTime(event.time));
  const [showDatePicker,  setShowDatePicker] = useState(false);
  const [showTimePicker,  setShowTimePicker] = useState(false);
  const [locationName,    setLocationName]   = useState(event.location?.name || '');
  const [locationCoords,  setLocationCoords] = useState(
    event.location?.lat && event.location?.lng
      ? { latitude: event.location.lat, longitude: event.location.lng }
      : null
  );
  const [showMapModal,    setShowMapModal]   = useState(false);
  const [isFree,          setIsFree]         = useState(event.isFree !== false);
  const [price,           setPrice]          = useState(event.price?.toString() || '');
  const [isVirtual,       setIsVirtual]      = useState(event.isVirtual || false);
  const [virtualLink,     setVirtualLink]    = useState(event.virtualLink || '');
  const [image,           setImage]          = useState(event.image || null);
  const [newImage,        setNewImage]       = useState(null);
  const [loading,         setLoading]        = useState(false);

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

  const handleSave = async () => {
    if (!title || !category) {
      Alert.alert('Error', 'Completá los campos obligatorios');
      return;
    }
    if (!isVirtual && !locationCoords) {
      Alert.alert('Error', 'Seleccioná la ubicación en el mapa');
      return;
    }
    if (isVirtual && !virtualLink) {
      Alert.alert('Error', 'Ingresá el link del evento virtual');
      return;
    }
    if (isVirtual && virtualLink && !isValidWebURL(virtualLink)) {
      Alert.alert('Link inválido', 'El link debe comenzar con https://');
      return;
    }

    setLoading(true);
    try {
      let imageURL = image;
      if (newImage) imageURL = await uploadImage(newImage);

      await updateDoc(doc(db, 'events', event.id), {
        title,
        description,
        category,
        date: storageDate(date),
        time: storageTime(time),
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

      Alert.alert('¡Listo!', 'Evento actualizado', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el evento');
    }
    setLoading(false);
  };

  const displayImage = newImage || image;
  const step2Valid = isVirtual ? virtualLink.trim().length > 0 : locationCoords !== null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} accessibilityLabel="Cerrar">
          <Ionicons name="close" size={24} color={colors['text.primary']} />
        </Pressable>
        <Text variant="title">Editar evento</Text>
        <Button variant="ghost" size="sm" label="Guardar" onPress={handleSave} loading={loading} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: space[16] }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Imagen */}
          <Field>
            <FieldLabel label="Foto o afiche" optional colors={colors} />
            <Pressable
              onPress={pickImage}
              style={[styles.imagePicker, { backgroundColor: colors['bg.surface'], borderColor: colors['border.strong'] }]}
              accessibilityRole="button"
            >
              {displayImage ? (
                <Image source={{ uri: displayImage }} style={styles.imagePreview} contentFit="cover" />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="image-outline" size={32} color={colors['text.tertiary']} />
                  <Text variant="caption" color="text.tertiary" style={{ marginTop: space[2] }}>Tocar para agregar</Text>
                </View>
              )}
            </Pressable>
          </Field>

          {/* Título */}
          <Field>
            <Input
              label="Nombre del evento"
              value={title}
              onChangeText={t => setTitle(t.slice(0, INPUT_LIMITS.EVENT_TITLE))}
              placeholder="Ej. Festival de la Luz 2026"
            />
          </Field>

          {/* Descripción */}
          <Field>
            <TextArea
              label="Descripción"
              value={description}
              onChangeText={setDescription}
              placeholder="Contá de qué se trata el evento…"
              maxLength={INPUT_LIMITS.EVENT_DESCRIPTION}
            />
          </Field>

          {/* Categoría — chips horizontales */}
          <Field>
            <FieldLabel label="Categoría" colors={colors} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={{ gap: space[2], alignItems: 'center' }}>
              {CATEGORIES.map(cat => {
                const active = category === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => setCategory(cat.id)}
                    style={[
                      styles.catChip,
                      {
                        backgroundColor: active ? cat.color + '33' : colors['bg.surface'],
                        borderColor: active ? cat.color : colors['border.strong'],
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                  >
                    <Ionicons name={cat.icon} size={16} color={active ? cat.color : colors['text.tertiary']} />
                    <Text style={{
                      fontSize: 14,
                      fontFamily: active ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium',
                      color: active ? cat.color : colors['text.secondary'],
                    }}>
                      {cat.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Field>

          {/* Fecha — un solo control, picker en Modal */}
          <Field>
            <FieldLabel label="Fecha" colors={colors} />
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={[styles.pickerRow, { backgroundColor: colors['bg.surface'], borderColor: colors['border.strong'] }]}
              accessibilityRole="button"
            >
              <Ionicons name="calendar-outline" size={20} color={colors['text.tertiary']} />
              <Text style={{ flex: 1, fontSize: 16, fontFamily: 'PlusJakartaSans_400Regular', color: colors['text.primary'] }}>
                {humanDate(date)}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors['text.tertiary']} />
            </Pressable>
            {Platform.OS === 'android' && showDatePicker && (
              <DateTimePicker value={date} mode="date" display="default"
                onChange={(_, d) => { setShowDatePicker(false); if (d) setDate(d); }} />
            )}
          </Field>

          {/* Hora */}
          <Field>
            <FieldLabel label="Hora" colors={colors} />
            <Pressable
              onPress={() => setShowTimePicker(true)}
              style={[styles.pickerRow, { backgroundColor: colors['bg.surface'], borderColor: colors['border.strong'] }]}
              accessibilityRole="button"
            >
              <Ionicons name="time-outline" size={20} color={colors['text.tertiary']} />
              <Text style={{ flex: 1, fontSize: 16, fontFamily: 'PlusJakartaSans_400Regular', color: colors['text.primary'] }}>
                {humanTime(time)}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors['text.tertiary']} />
            </Pressable>
            {Platform.OS === 'android' && showTimePicker && (
              <DateTimePicker value={time} mode="time" display="default"
                onChange={(_, t) => { setShowTimePicker(false); if (t) setTime(t); }} />
            )}
          </Field>

          {/* Modalidad — SegmentedControl */}
          <Field>
            <FieldLabel label="Modalidad" colors={colors} />
            <SegmentedControl
              options={[
                { label: 'Presencial', value: 'presencial' },
                { label: 'Virtual',    value: 'virtual' },
              ]}
              selected={isVirtual ? 'virtual' : 'presencial'}
              onSelect={v => setIsVirtual(v === 'virtual')}
            />
          </Field>

          {/* Lugar o link virtual */}
          {!isVirtual ? (
            <>
              <Field>
                <Input
                  label="Nombre del lugar"
                  value={locationName}
                  onChangeText={setLocationName}
                  placeholder="Ej. Teatro Nacional"
                />
              </Field>
              <Field>
                <FieldLabel label="Ubicación en el mapa" colors={colors} />
                <Pressable
                  onPress={() => setShowMapModal(true)}
                  style={[styles.mapBtn, { backgroundColor: locationCoords ? colors['status.free.bg'] : colors['bg.surface'], borderColor: locationCoords ? colors['status.free'] : colors['border.strong'] }]}
                >
                  <Ionicons name={locationCoords ? 'checkmark-circle' : 'map-outline'} size={20} color={locationCoords ? colors['status.free'] : colors['text.tertiary']} />
                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', color: locationCoords ? colors['status.free'] : colors['text.secondary'] }}>
                    {locationCoords ? 'Ubicación seleccionada' : 'Tocar para marcar en el mapa'}
                  </Text>
                </Pressable>
              </Field>
            </>
          ) : (
            <Field>
              <Input
                label="Link de la transmisión"
                value={virtualLink}
                onChangeText={setVirtualLink}
                placeholder="https://meet.google.com/..."
                keyboardType="url"
                autoCapitalize="none"
              />
            </Field>
          )}

          {/* Precio — SegmentedControl */}
          <Field>
            <FieldLabel label="Entrada" colors={colors} />
            <SegmentedControl
              options={[
                { label: 'Gratis', value: 'gratis' },
                { label: 'De pago', value: 'pago' },
              ]}
              selected={isFree ? 'gratis' : 'pago'}
              onSelect={v => setIsFree(v === 'gratis')}
            />
          </Field>

          {!isFree && (
            <Field>
              <Input
                label="Precio en colones"
                value={price}
                onChangeText={setPrice}
                placeholder="Ej. 5000"
                keyboardType="numeric"
              />
            </Field>
          )}

          {!step2Valid && (
            <Text variant="caption" color="text.tertiary" align="center" style={{ marginTop: space[1] }}>
              {isVirtual ? 'Falta el link del evento virtual' : 'Falta elegir la ubicación en el mapa'}
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Pickers iOS en Modal (sin valor duplicado debajo del campo) */}
      {Platform.OS === 'ios' && (
        <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
          <Pressable style={styles.pickerOverlay} onPress={() => setShowDatePicker(false)} />
          <View style={[styles.pickerSheet, { backgroundColor: colors['bg.raised'] }]}>
            <View style={[styles.pickerSheetHeader, { borderBottomColor: colors['border.subtle'] }]}>
              <Pressable onPress={() => setShowDatePicker(false)} style={{ padding: space[2] }}>
                <Text variant="label" color="link">Listo</Text>
              </Pressable>
            </View>
            <DateTimePicker value={date} mode="date" display="spinner"
              onChange={(_, d) => { if (d) setDate(d); }}
              themeVariant={isDark ? 'dark' : 'light'} />
          </View>
        </Modal>
      )}
      {Platform.OS === 'ios' && (
        <Modal visible={showTimePicker} transparent animationType="slide" onRequestClose={() => setShowTimePicker(false)}>
          <Pressable style={styles.pickerOverlay} onPress={() => setShowTimePicker(false)} />
          <View style={[styles.pickerSheet, { backgroundColor: colors['bg.raised'] }]}>
            <View style={[styles.pickerSheetHeader, { borderBottomColor: colors['border.subtle'] }]}>
              <Pressable onPress={() => setShowTimePicker(false)} style={{ padding: space[2] }}>
                <Text variant="label" color="link">Listo</Text>
              </Pressable>
            </View>
            <DateTimePicker value={time} mode="time" display="spinner"
              onChange={(_, t) => { if (t) setTime(t); }}
              themeVariant={isDark ? 'dark' : 'light'} />
          </View>
        </Modal>
      )}

      {/* Modal de mapa */}
      <Modal visible={showMapModal} animationType="slide" onRequestClose={() => setShowMapModal(false)}>
        <View style={{ flex: 1 }}>
          <MapView
            style={StyleSheet.absoluteFill}
            initialRegion={{
              latitude: locationCoords?.latitude || 9.9281,
              longitude: locationCoords?.longitude || -84.0907,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            onPress={e => setLocationCoords(e.nativeEvent.coordinate)}
            showsUserLocation
          >
            {locationCoords && <Marker coordinate={locationCoords} />}
          </MapView>
          <View style={[styles.mapModalFooter, { backgroundColor: colors['bg.raised'], paddingBottom: insets.bottom + space[3] }]}>
            <Text variant="caption" color="text.tertiary">
              {locationCoords ? 'Ubicación seleccionada. Tocá en el mapa para moverla.' : 'Tocá en el mapa para marcar la ubicación'}
            </Text>
            <Pressable
              onPress={() => locationCoords ? setShowMapModal(false) : Alert.alert('', 'Seleccioná un punto en el mapa')}
              style={[styles.ctaBtn, { backgroundColor: locationCoords ? colors['action.primary'] : colors['bg.surface'], marginTop: space[3] }]}
            >
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: locationCoords ? colors['text.onAction'] : colors['text.tertiary'] }}>
                Confirmar ubicación
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[5],
    paddingVertical: space[4],
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  fieldWrap: { marginBottom: space[4] },

  // Imagen
  imagePicker: {
    height: 160,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  imagePreview: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Chips de categoría
  chipScroll: { flexGrow: 0, marginTop: 4 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    borderWidth: 1.5,
    gap: space[2],
    flexShrink: 0,
  },

  // Pickers de fecha/hora
  pickerRow: {
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[3],
    gap: space[2],
  },

  // Botón de mapa
  mapBtn: {
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[3],
    gap: space[2],
  },
  ctaBtn: {
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modals de picker iOS
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  pickerSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
  },
  pickerSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  // Modal de mapa
  mapModalFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: space[5],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
});

// CreateEventScreen — flujo de 3 pasos según FIX_ROUND_2 § 6
// LÓGICA INTACTA: imagen, ubicación, upload, createEvent, notifyFollowers.
// PRESENTACIÓN: 3 pasos, chips de categorías, fechas humanas, CTA amarillo, sin asteriscos.
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { doc, getDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StyleSheet, TextInput, View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EventRow from '../components/ui/EventRow';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import Text from '../components/ui/Text';

import { auth, db, storage } from '../config/firebase';
import { notifyFollowers, NOTIFICATION_TYPES } from '../services/notificationService';
import { createEvent } from '../services/eventService';
import { CATEGORIES } from '../constants/categories';
import {
  isValidWebURL, validateImageSize, validatePrice, INPUT_LIMITS,
} from '../utils/security';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';

// ─── Formateo de fecha/hora humano ───────────────────────────────────────────

const DAYS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MONTHS= ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function humanDate(d) {
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
function humanTime(t) {
  let h = t.getHours(), m = t.getMinutes();
  const mer = h >= 12 ? 'pm' : 'am';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2,'0')} ${mer}`;
}
function storageDate(d) {
  return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
}
function storageTime(t) {
  return `${t.getHours().toString().padStart(2,'0')}:${t.getMinutes().toString().padStart(2,'0')}`;
}

// ─── Componentes inline ───────────────────────────────────────────────────────

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

function TextBox({ value, onChangeText, placeholder, multiline, maxLength, keyboardType, colors }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors['text.tertiary']}
      multiline={multiline}
      maxLength={maxLength}
      keyboardType={keyboardType}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.textInput,
        multiline && styles.textArea,
        {
          color: colors['text.primary'],
          backgroundColor: colors['bg.surface'],
          borderColor: focused ? colors['nav.selected'] : colors['border.strong'],
          fontFamily: 'PlusJakartaSans_400Regular',
        },
      ]}
    />
  );
}

// ─── CreateEventScreen ────────────────────────────────────────────────────────

export default function CreateEventScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [step,            setStep]           = useState(1);
  const [title,           setTitle]          = useState('');
  const [description,     setDescription]    = useState('');
  const [category,        setCategory]       = useState('');
  const [image,           setImage]          = useState(null);
  const [date,            setDate]           = useState(new Date());
  const [time,            setTime]           = useState(new Date());
  const [showDatePicker,  setShowDatePicker] = useState(false);
  const [showTimePicker,  setShowTimePicker] = useState(false);
  const [isVirtual,       setIsVirtual]      = useState(false);
  const [virtualLink,     setVirtualLink]    = useState('');
  const [locationName,    setLocationName]   = useState('');
  const [locationCoords,  setLocationCoords] = useState(null);
  const [showMapModal,    setShowMapModal]   = useState(false);
  const [isFree,          setIsFree]         = useState(true);
  const [price,           setPrice]          = useState('');
  const [loading,         setLoading]        = useState(false);
  const [uploadingImage,  setUploadingImage] = useState(false);
  const [currentLocation, setCurrentLocation]= useState({ latitude: 9.9281, longitude: -84.0907, latitudeDelta: 0.05, longitudeDelta: 0.05 });

  useEffect(() => {
    Location.requestForegroundPermissionsAsync()
      .then(({ status }) => {
        if (status === 'granted') Location.getCurrentPositionAsync({}).then(l => setCurrentLocation({
          latitude: l.coords.latitude, longitude: l.coords.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05,
        })).catch(() => {});
      }).catch(() => {});
  }, []);

  // ── Validación por paso ───────────────────────────────────────────────────

  const step1Valid = title.trim().length >= 2 && category !== '';
  const step2Valid = isVirtual
    ? virtualLink.trim().length > 0
    : locationCoords !== null;
  const step3Valid = isFree || (validatePrice(price) !== null);

  // ── Lógica de imagen ──────────────────────────────────────────────────────

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 9], quality: 0.8,
    });
    if (!result.canceled) {
      if (!validateImageSize(result.assets[0])) { Alert.alert('Imagen grande', 'La imagen debe ser menor a 5MB'); return; }
      setImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso denegado', 'Necesitamos acceso a tu cámara'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [16, 9], quality: 0.8 });
    if (!result.canceled) {
      if (!validateImageSize(result.assets[0])) { Alert.alert('Imagen grande', 'La imagen debe ser menor a 5MB'); return; }
      setImage(result.assets[0].uri);
    }
  };

  const showImageOptions = () => Alert.alert('Agregar imagen', 'Elegí una opción', [
    { text: 'Tomar foto',       onPress: takePhoto },
    { text: 'Elegir de galería', onPress: pickImage },
    { text: 'Cancelar', style: 'cancel' },
  ]);

  const uploadImage = async (uri) => {
    const blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => resolve(xhr.response);
      xhr.onerror = () => reject(new Error('Error al leer imagen'));
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });
    const filename = `events/${auth.currentUser?.uid}/${Date.now()}.jpg`;
    const storageRef = ref(storage, filename);
    await uploadBytes(storageRef, blob);
    const url = await getDownloadURL(storageRef);
    blob.close();
    return url;
  };

  // ── Publicar evento ────────────────────────────────────────────────────────

  const handlePublish = async () => {
    if (!step3Valid) return;
    if (!isVirtual && !locationCoords) { Alert.alert('Error', 'Seleccioná la ubicación en el paso 2'); return; }
    if (isVirtual && !isValidWebURL(virtualLink)) { Alert.alert('Error', 'El link debe comenzar con https:// o http://'); return; }

    setLoading(true);
    try {
      const user = auth.currentUser;
      let imageURL = '';
      if (image) { setUploadingImage(true); imageURL = await uploadImage(image); setUploadingImage(false); }

      const eventData = {
        title: title.trim(),
        description: description.trim(),
        category,
        date: storageDate(date),
        time: storageTime(time),
        location: {
          name: locationName.trim(),
          lat: locationCoords?.latitude || 0,
          lng: locationCoords?.longitude || 0,
        },
        isVirtual,
        virtualLink: isVirtual ? virtualLink.trim() : '',
        isFree,
        price: isFree ? 0 : validatePrice(price),
        organizerId: user.uid,
        organizerName: user.displayName || user.email.split('@')[0],
        organizerAvatar: user.photoURL || '',
        image: imageURL,
        capacity: 0,
        hasParking: false,
      };

      const newEventId = await createEvent(eventData);

      Alert.alert('¡Publicado!', 'Tu evento ya está en Enfiestados', [
        { text: 'Ver evento', onPress: () => { navigation.goBack(); navigation.navigate('EventDetail', { event: { id: newEventId, ...eventData } }); } },
        { text: 'Listo', onPress: () => navigation.goBack() },
      ]);

      getDoc(doc(db, 'users', user.uid)).then(snap => {
        const followers = snap.data()?.followers || [];
        notifyFollowers(followers, {
          type: NOTIFICATION_TYPES.NEW_EVENT,
          fromUserId: user.uid,
          fromUserName: user.displayName || user.email.split('@')[0],
          fromUserAvatar: user.photoURL || '',
          message: `creó un nuevo evento: ${title.trim()}`,
          eventId: newEventId,
          eventData: { ...eventData, id: newEventId },
        });
      }).catch(() => {});
    } catch {
      Alert.alert('Error', 'No se pudo crear el evento. Intentá de nuevo.');
    }
    setLoading(false);
  };

  // ── Handlers de paso ──────────────────────────────────────────────────────

  const goNext = () => {
    if (step < 3) setStep(s => s + 1);
    else handlePublish();
  };
  const goBack = () => {
    if (step > 1) setStep(s => s - 1);
  };

  const confirmClose = () => Alert.alert('¿Salir?', '¿Querés guardar el borrador o descartarlo?', [
    { text: 'Descartar', style: 'destructive', onPress: () => navigation.goBack() },
    { text: 'Guardar borrador', onPress: () => navigation.goBack() },
    { text: 'Seguir editando', style: 'cancel' },
  ]);

  const stepTitles = ['¿Qué vas a organizar?', '¿Cuándo y dónde?', '¿Cuánto cuesta?'];
  const continueLabel = step === 3 ? (loading ? (uploadingImage ? 'Subiendo imagen…' : 'Publicando…') : 'Publicar') : 'Continuar';
  const stepIsValid = [step1Valid, step2Valid, step3Valid][step - 1];

  return (
    <View style={[styles.screen, { backgroundColor: colors['bg.base'] }]}>

      {/* ── HEADER: progreso + cerrar ─────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + space[2] }]}>
        {step > 1 ? (
          <Pressable onPress={goBack} style={styles.iconBtn} accessibilityLabel="Volver">
            <Ionicons name="arrow-back" size={22} color={colors['text.primary']} />
          </Pressable>
        ) : <View style={styles.iconBtn} />}

        <View style={{ flex: 1, gap: space[2] }}>
          <View style={styles.progressRow}>
            <Text variant="caption" color="text.tertiary">Paso {step} de 3</Text>
            <Text variant="caption" color="text.tertiary">Borrador guardado</Text>
          </View>
          {/* Barra de progreso amarilla */}
          <View style={[styles.progressTrack, { backgroundColor: colors['bg.surface'] }]}>
            <View style={[styles.progressFill, { width: `${(step / 3) * 100}%`, backgroundColor: colors['action.primary'] }]} />
          </View>
        </View>

        <Pressable onPress={confirmClose} style={styles.iconBtn} accessibilityLabel="Cerrar">
          <Ionicons name="close" size={22} color={colors['text.primary']} />
        </Pressable>
      </View>

      {/* ── TÍTULO DEL PASO ───────────────────────────────────────────── */}
      <Text style={[styles.stepTitle, { color: colors['text.primary'], fontFamily: 'BricolageGrotesque_700Bold' }]}>
        {stepTitles[step - 1]}
      </Text>

      {/* ── CAMPOS ───────────────────────────────────────────────────── */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── PASO 1: Qué ─────────────────────────────────────────── */}
          {step === 1 && (
            <>
              {/* Imagen — opcional */}
              <Field>
                <FieldLabel label="Foto o afiche" optional colors={colors} />
                <Pressable
                  onPress={showImageOptions}
                  style={[styles.imagePicker, { backgroundColor: colors['bg.surface'], borderColor: colors['border.strong'] }]}
                  accessibilityRole="button"
                >
                  {image ? (
                    <Image source={{ uri: image }} style={styles.imagePreview} contentFit="cover" />
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
                <FieldLabel label="Nombre del evento" colors={colors} />
                <TextBox
                  value={title}
                  onChangeText={t => setTitle(t.slice(0, INPUT_LIMITS.EVENT_TITLE))}
                  placeholder="Ej. Festival de la Luz 2026"
                  colors={colors}
                />
              </Field>

              {/* Descripción — opcional */}
              <Field>
                <FieldLabel label="Descripción" optional colors={colors} />
                <TextBox
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Contá de qué se trata el evento…"
                  multiline
                  maxLength={INPUT_LIMITS.EVENT_DESCRIPTION}
                  colors={colors}
                />
                <Text variant="caption" color="text.tertiary" style={{ textAlign: 'right', marginTop: 4 }}>
                  {description.length}/{INPUT_LIMITS.EVENT_DESCRIPTION}
                </Text>
              </Field>

              {/* Categoría — chips horizontales, nunca grilla */}
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
            </>
          )}

          {/* ── PASO 2: Cuándo y dónde ───────────────────────────────── */}
          {step === 2 && (
            <>
              {/* Fecha — un solo control, picker en Modal (§ 1.2) */}
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
                {/* Android: diálogo nativo auto-dismiss. iOS: Modal + Listo */}
                {Platform.OS === 'android' && showDatePicker && (
                  <DateTimePicker value={date} mode="date" display="default" minimumDate={new Date()}
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

              {/* Tipo — SegmentedControl, no dos botones violetas */}
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

              {/* Lugar (condicional) */}
              {!isVirtual ? (
                <>
                  <Field>
                    <FieldLabel label="Nombre del lugar" optional colors={colors} />
                    <TextBox
                      value={locationName}
                      onChangeText={setLocationName}
                      placeholder="Ej. Teatro Nacional"
                      colors={colors}
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
                  <FieldLabel label="Link de la transmisión" colors={colors} />
                  <TextBox
                    value={virtualLink}
                    onChangeText={setVirtualLink}
                    placeholder="https://meet.google.com/..."
                    keyboardType="url"
                    colors={colors}
                  />
                </Field>
              )}
            </>
          )}

          {/* ── PASO 3: Precio + vista previa ────────────────────────── */}
          {step === 3 && (
            <>
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
                  <FieldLabel label="Precio en colones" colors={colors} />
                  <TextBox
                    value={price}
                    onChangeText={setPrice}
                    placeholder="Ej. 5000"
                    keyboardType="numeric"
                    colors={colors}
                  />
                </Field>
              )}

              {/* Vista previa real del EventRow */}
              <View style={[styles.previewSection, { borderColor: colors['border.subtle'] }]}>
                <Text variant="overline" color="text.tertiary" style={{ paddingHorizontal: space[5], paddingBottom: space[2] }}>
                  ASÍ SE VE EN EL FEED
                </Text>
                <View style={{ borderRadius: radius.lg, overflow: 'hidden', marginHorizontal: space[5], backgroundColor: colors['bg.surface'] }}>
                  <EventRow
                    event={{
                      title: title || 'Nombre del evento',
                      category: category || '',
                      date: storageDate(date),
                      time: storageTime(time),
                      image: image || null,
                      isFree,
                      price: isFree ? 0 : (parseInt(price) || undefined),
                      location: { name: locationName || (isVirtual ? 'Evento virtual' : 'Sin ubicación') },
                    }}
                    trailing="auto"
                    onPress={() => {}}
                  />
                </View>
              </View>
            </>
          )}
        </ScrollView>

        {/* ── BARRA DE ACCIÓN FIJA (§ 1.5: contraste + razón) ────────── */}
        <View style={[styles.actionBar, { paddingBottom: Math.max(space[4], insets.bottom), borderTopColor: colors['border.subtle'], backgroundColor: colors['bg.base'] }]}>
          {/* Razón por la que está deshabilitado */}
          {!stepIsValid && step === 2 && !isVirtual && !locationCoords && (
            <Text variant="caption" color="text.tertiary" align="center" style={{ marginBottom: space[2] }}>
              Falta elegir la ubicación en el mapa
            </Text>
          )}
          {!stepIsValid && step === 2 && isVirtual && !virtualLink && (
            <Text variant="caption" color="text.tertiary" align="center" style={{ marginBottom: space[2] }}>
              Ingresá el link del evento virtual
            </Text>
          )}
          <Pressable
            onPress={goNext}
            disabled={!stepIsValid || loading}
            style={[
              styles.ctaBtn,
              stepIsValid && !loading
                ? { backgroundColor: colors['action.primary'] }
                : { backgroundColor: colors['bg.surface'] },  // disabled: legible, no acción
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !stepIsValid || loading }}
          >
            <Text style={{
              fontSize: 16,
              fontFamily: 'PlusJakartaSans_700Bold',
              color: stepIsValid && !loading
                ? colors['text.onAction']
                : colors['text.secondary'],  // 4.6:1 sobre bg.surface
            }}>
              {continueLabel}
            </Text>
            {step < 3 && stepIsValid && (
              <Ionicons name="chevron-forward" size={18} color={colors['text.onAction']} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* ── Pickers iOS en Modal (§ 1.2: sin valor duplicado debajo) ──── */}
      {Platform.OS === 'ios' && (
        <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
          <Pressable style={styles.pickerOverlay} onPress={() => setShowDatePicker(false)} />
          <View style={[styles.pickerSheet, { backgroundColor: colors['bg.raised'] }]}>
            <View style={[styles.pickerSheetHeader, { borderBottomColor: colors['border.subtle'] }]}>
              <Pressable onPress={() => setShowDatePicker(false)} style={{ padding: space[2] }}>
                <Text variant="label" color="link">Listo</Text>
              </Pressable>
            </View>
            <DateTimePicker value={date} mode="date" display="spinner" minimumDate={new Date()}
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

      {/* ── MODAL DE MAPA ────────────────────────────────────────────── */}
      <Modal visible={showMapModal} animationType="slide" onRequestClose={() => setShowMapModal(false)}>
        <View style={{ flex: 1 }}>
          <MapView
            style={StyleSheet.absoluteFill}
            initialRegion={currentLocation}
            onPress={e => setLocationCoords(e.nativeEvent.coordinate)}
            showsUserLocation
          >
            {locationCoords && (
              <Marker coordinate={locationCoords} />
            )}
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
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingBottom: space[3],
    gap: space[4],
    flexShrink: 0,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressTrack: { height: 6, borderRadius: radius.full, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: radius.full },

  stepTitle: {
    fontSize: 28,
    lineHeight: 34,
    paddingHorizontal: space[5],
    paddingBottom: space[4],
  },

  fieldWrap: { marginBottom: space[4] },

  textInput: {
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: space[3],
    fontSize: 16,
  },
  textArea: {
    height: 100,
    paddingTop: space[3],
    textAlignVertical: 'top',
  },

  // Imagen picker
  imagePicker: {
    height: 160,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  imagePreview: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Chips de categoría — horizontal, 46px
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

  // Botón mapa
  mapBtn: {
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[3],
    gap: space[2],
  },

  // Vista previa
  previewSection: {
    marginTop: space[4],
    paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    marginHorizontal: -space[5], // sangría hasta los bordes
  },

  // Action bar
  actionBar: {
    paddingHorizontal: space[5],
    paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
  },
  ctaBtn: {
    height: 56,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },

  // Modals de picker iOS (§ 1.2)
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
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

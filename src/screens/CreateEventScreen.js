// CreateEventScreen — flujo de 3 pasos según FIX_ROUND_2 § 6
// LÓGICA INTACTA: imagen, ubicación, upload, createEvent, notifyFollowers.
// PRESENTACIÓN: 3 pasos, chips de categorías, fechas humanas, CTA amarillo, sin asteriscos.
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePreventRemove } from '@react-navigation/native';
import {
  Alert, BackHandler, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StyleSheet, TextInput, View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EventCardLarge from '../components/ui/EventCardLarge';
import ImageGridPicker from '../components/ui/ImageGridPicker';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import Text from '../components/ui/Text';

import { auth, db } from '../config/firebase';
import VerifyEmailSheet from '../components/VerifyEmailSheet';
import { needsEmailVerification } from '../lib/emailVerification';
import { clearEventDraft, loadEventDraft, saveEventDraft } from '../lib/eventDraft';
import { notifyFollowers, NOTIFICATION_TYPES } from '../services/notificationService';
import { createEvent } from '../services/eventService';
import { CATEGORIES } from '../constants/categories';
import {
  isValidWebURL, validatePrice, INPUT_LIMITS,
} from '../utils/security';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

// ─── Formateo de fecha/hora humano ───────────────────────────────────────────

function humanDate(d) {
  const days = i18n.t('format.daysShort', { returnObjects: true });
  const months = i18n.t('format.monthsShort', { returnObjects: true });
  return i18n.t('format.eventDate', { day: days[d.getDay()], date: d.getDate(), month: months[d.getMonth()] });
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
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 }}>
      <Text style={{ fontSize: 14.5, fontFamily: 'PlusJakartaSans_700Bold', color: colors['text.secondary'] }}>
        {label}
      </Text>
      {optional && (
        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: colors['text.tertiary'] }}>
          {t('createEvent.optional')}
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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [step,            setStep]           = useState(1);
  const [title,           setTitle]          = useState('');
  const [description,     setDescription]    = useState('');
  const [category,        setCategory]       = useState('');
  const [images,          setImages]         = useState([]); // URLs ya subidas — ImageGridPicker sube en cuanto se eligen
  const [imagesUploading, setImagesUploading]= useState(false);
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
  const [currentLocation, setCurrentLocation]= useState({ latitude: 9.9281, longitude: -84.0907, latitudeDelta: 0.05, longitudeDelta: 0.05 });
  // pickerKey remonta ImageGridPicker con las imágenes del borrador: solo
  // lee initialUrls al montar.
  const [pickerKey,       setPickerKey]      = useState(0);
  const [fromDraft,       setFromDraft]      = useState(false);
  // leaving = ya se decidió salir (publicado, descartado o guardado): apaga
  // la pregunta de usePreventRemove para que la navegación pendiente pase.
  const [leaving,         setLeaving]        = useState(false);
  const pendingExitRef = useRef(null);
  const uid = auth.currentUser?.uid;
  // Las reglas solo dejan publicar con el correo verificado (isVerified).
  const [showVerify,      setShowVerify]     = useState(false);
  // Ya se publicó: el autoguardado pendiente no debe revivir el borrador.
  const publishedRef = useRef(false);

  // Al abrir: si hay un borrador guardado, ofrecer retomarlo.
  useEffect(() => {
    loadEventDraft(uid).then(draft => {
      if (!draft) return;
      Alert.alert(t('createEvent.draftFound'), t('createEvent.draftFoundMsg'), [
        { text: t('createEvent.startOver'), style: 'destructive', onPress: () => clearEventDraft(uid) },
        { text: t('createEvent.continueDraft'), onPress: () => applyDraft(draft) },
      ], { cancelable: false });
    });
  }, []);

  const applyDraft = (d) => {
    setStep(d.step || 1);
    setTitle(d.title || '');
    setDescription(d.description || '');
    setCategory(d.category || '');
    setImages(d.images || []);
    setPickerKey(k => k + 1);
    setDate(d.date);
    setTime(d.time);
    setIsVirtual(!!d.isVirtual);
    setVirtualLink(d.virtualLink || '');
    setLocationName(d.locationName || '');
    setLocationCoords(d.locationCoords || null);
    setIsFree(d.isFree !== false);
    setPrice(d.price || '');
    setFromDraft(true);
  };

  const currentDraft = () => ({
    step, title, description, category, images, date, time,
    isVirtual, virtualLink, locationName, locationCoords, isFree, price,
  });

  // ¿Hay algo que se perdería al salir?
  const isDirty = !!(
    title.trim() || description.trim() || category || images.length ||
    virtualLink.trim() || locationName.trim() || locationCoords || price.trim?.()
  );

  // Autoguardado: un segundo después del último cambio. Así, si la app se
  // cierra (o el sistema la mata) a mitad del formulario o después de un
  // error al publicar, el borrador se ofrece al volver a abrir Crear.
  useEffect(() => {
    if (!isDirty || leaving) return;
    const id = setTimeout(() => {
      if (!publishedRef.current) saveEventDraft(uid, currentDraft());
    }, 1000);
    return () => clearTimeout(id);
  }, [step, title, description, category, images, date, time, isVirtual, virtualLink,
      locationName, locationCoords, isFree, price, leaving]);

  // Sale de la pantalla sin volver a preguntar. La navegación espera al
  // render con leaving=true, porque usePreventRemove lee el valor del render.
  const exitWith = (fn) => {
    pendingExitRef.current = fn;
    setLeaving(true);
  };
  useEffect(() => {
    if (!leaving || !pendingExitRef.current) return;
    const fn = pendingExitRef.current;
    pendingExitRef.current = null;
    fn();
  }, [leaving]);

  // Cualquier salida (X, botón atrás de Android, gesto de cerrar el modal en
  // iOS) pasa por acá. Antes solo la X preguntaba, y el "Guardar borrador"
  // no guardaba nada: el atrás de Android borraba todo sin avisar.
  usePreventRemove(isDirty && !leaving, ({ data }) => {
    Alert.alert(t('createEvent.leaveTitle'), t('createEvent.leaveMsg'), [
      { text: t('createEvent.keepEditing'), style: 'cancel' },
      {
        text: t('createEvent.discard'),
        style: 'destructive',
        onPress: () => exitWith(() => { clearEventDraft(uid); navigation.dispatch(data.action); }),
      },
      {
        text: t('createEvent.saveDraftBtn'),
        onPress: () => exitWith(async () => { await saveEventDraft(uid, currentDraft()); navigation.dispatch(data.action); }),
      },
    ]);
  });

  // Atrás de Android en el paso 2 o 3: vuelve un paso, como la flecha del
  // header, en vez de intentar cerrar el formulario.
  useEffect(() => {
    if (step === 1) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setStep(s => s - 1);
      return true;
    });
    return () => sub.remove();
  }, [step]);

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
  const step3Valid = (isFree || (validatePrice(price) !== null)) && !imagesUploading;

  // ── Publicar evento ────────────────────────────────────────────────────────

  const handlePublish = async () => {
    if (!step3Valid) return;
    if (!isVirtual && !locationCoords) { Alert.alert(t('common.error'), t('createEvent.selectLocationStep2')); return; }
    if (isVirtual && !isValidWebURL(virtualLink)) { Alert.alert(t('common.error'), t('createEvent.linkProtocol')); return; }

    setLoading(true);
    try {
      if (await needsEmailVerification()) {
        setLoading(false);
        setShowVerify(true);
        return;
      }
      const user = auth.currentUser;
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
        images,
        image: images[0] || '', // back-compat: consumidores viejos leen 'image' (FIX_ROUND_5 § 6)
        capacity: 0,
        hasParking: false,
      };

      const newEventId = await createEvent(eventData);
      publishedRef.current = true;
      clearEventDraft(uid);

      Alert.alert(t('createEvent.published'), t('createEvent.publishedMsg'), [
        { text: t('createEvent.viewEvent'), onPress: () => exitWith(() => { navigation.goBack(); navigation.navigate('EventDetail', { event: { id: newEventId, ...eventData } }); }) },
        { text: t('createEvent.done'), onPress: () => exitWith(() => navigation.goBack()) },
      ], { cancelable: false });

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
    } catch (e) {
      saveEventDraft(uid, currentDraft());
      // Por si el correo se des-verificó o el token quedó viejo: lo normal es
      // que needsEmailVerification ya lo haya atajado antes de intentar.
      if (e?.code === 'permission-denied' && await needsEmailVerification()) {
        setShowVerify(true);
      } else {
        Alert.alert(t('common.error'), t('createEvent.createError'));
      }
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

  // La pregunta (seguir / descartar / guardar) la hace usePreventRemove.
  const confirmClose = () => navigation.goBack();

  const stepTitles = [t('createEvent.stepWhat'), t('createEvent.stepWhen'), t('createEvent.stepPrice')];
  const continueLabel = step === 3
    ? (loading ? t('createEvent.publishing') : (imagesUploading ? t('createEvent.uploadingImages') : t('createEvent.publish')))
    : t('createEvent.continue');
  const stepIsValid = [step1Valid, step2Valid, step3Valid][step - 1];

  return (
    <View style={[styles.screen, { backgroundColor: colors['bg.base'] }]}>

      {/* ── HEADER: progreso + cerrar ─────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + space[2] }]}>
        {step > 1 ? (
          <Pressable onPress={goBack} style={styles.iconBtn} accessibilityLabel={t('common.back')}>
            <Ionicons name="arrow-back" size={22} color={colors['text.primary']} />
          </Pressable>
        ) : <View style={styles.iconBtn} />}

        <View style={{ flex: 1, gap: space[2] }}>
          <View style={styles.progressRow}>
            <Text variant="caption" color="text.tertiary">{t('createEvent.stepOf', { step })}</Text>
            {/* Antes decía "Borrador guardado" siempre, sin que se guardara nada. */}
            {fromDraft && <Text variant="caption" color="text.tertiary">{t('createEvent.draftRecovered')}</Text>}
          </View>
          {/* Barra de progreso amarilla */}
          <View style={[styles.progressTrack, { backgroundColor: colors['bg.surface'] }]}>
            <View style={[styles.progressFill, { width: `${(step / 3) * 100}%`, backgroundColor: colors['action.primary'] }]} />
          </View>
        </View>

        <Pressable onPress={confirmClose} style={styles.iconBtn} accessibilityLabel={t('common.close')}>
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
              {/* Imágenes — opcional, hasta 10, reordenables (FIX_ROUND_5 § 5) */}
              <Field>
                <FieldLabel label={t('createEvent.photo')} optional colors={colors} />
                {/* initialUrls={images}: el picker se desmonta en los pasos 2 y 3
                    y, al volver al 1, arrancaba vacío y borraba las imágenes ya
                    subidas (onUploadedChange([])). */}
                <ImageGridPicker key={pickerKey} initialUrls={images} onUploadedChange={setImages} onBusyChange={setImagesUploading} />
              </Field>

              {/* Título */}
              <Field>
                <FieldLabel label={t('createEvent.eventName')} colors={colors} />
                <TextBox
                  value={title}
                  onChangeText={v => setTitle(v.slice(0, INPUT_LIMITS.EVENT_TITLE))}
                  placeholder={t('createEvent.eventNamePlaceholder')}
                  colors={colors}
                />
              </Field>

              {/* Descripción — opcional */}
              <Field>
                <FieldLabel label={t('createEvent.description')} optional colors={colors} />
                <TextBox
                  value={description}
                  onChangeText={setDescription}
                  placeholder={t('createEvent.descriptionPlaceholder')}
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
                <FieldLabel label={t('createEvent.category')} colors={colors} />
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
                <FieldLabel label={t('createEvent.date')} colors={colors} />
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
                <FieldLabel label={t('createEvent.time')} colors={colors} />
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
                    onChange={(_, v) => { setShowTimePicker(false); if (v) setTime(v); }} />
                )}
              </Field>

              {/* Tipo — SegmentedControl, no dos botones violetas */}
              <Field>
                <FieldLabel label={t('createEvent.mode')} colors={colors} />
                <SegmentedControl
                  options={[
                    { label: t('createEvent.inPerson'), value: 'presencial' },
                    { label: t('createEvent.virtual'), value: 'virtual' },
                  ]}
                  selected={isVirtual ? 'virtual' : 'presencial'}
                  onSelect={v => setIsVirtual(v === 'virtual')}
                />
              </Field>

              {/* Lugar (condicional) */}
              {!isVirtual ? (
                <>
                  <Field>
                    <FieldLabel label={t('createEvent.venueName')} optional colors={colors} />
                    <TextBox
                      value={locationName}
                      onChangeText={setLocationName}
                      placeholder={t('createEvent.venuePlaceholder')}
                      colors={colors}
                    />
                  </Field>
                  <Field>
                    <FieldLabel label={t('createEvent.mapLocation')} colors={colors} />
                    <Pressable
                      onPress={() => setShowMapModal(true)}
                      style={[styles.mapBtn, { backgroundColor: locationCoords ? colors['status.free.bg'] : colors['bg.surface'], borderColor: locationCoords ? colors['status.free'] : colors['border.strong'] }]}
                    >
                      <Ionicons name={locationCoords ? 'checkmark-circle' : 'map-outline'} size={20} color={locationCoords ? colors['status.free'] : colors['text.tertiary']} />
                      <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', color: locationCoords ? colors['status.free'] : colors['text.secondary'] }}>
                        {locationCoords ? t('createEvent.locationSelected') : t('createEvent.tapToMark')}
                      </Text>
                    </Pressable>
                  </Field>
                </>
              ) : (
                <Field>
                  <FieldLabel label={t('createEvent.streamLink')} colors={colors} />
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
                <FieldLabel label={t('createEvent.ticket')} colors={colors} />
                <SegmentedControl
                  options={[
                    { label: t('common.free'), value: 'gratis' },
                    { label: t('createEvent.paid'), value: 'pago' },
                  ]}
                  selected={isFree ? 'gratis' : 'pago'}
                  onSelect={v => setIsFree(v === 'gratis')}
                />
              </Field>

              {!isFree && (
                <Field>
                  <FieldLabel label={t('createEvent.priceColones')} colors={colors} />
                  <TextBox
                    value={price}
                    onChangeText={setPrice}
                    placeholder={t('createEvent.pricePlaceholder')}
                    keyboardType="numeric"
                    colors={colors}
                  />
                </Field>
              )}

              {/* Vista previa real de EventCardLarge — la card que se usa en el feed */}
              <View style={[styles.previewSection, { borderColor: colors['border.subtle'] }]}>
                <Text variant="overline" color="text.tertiary" style={{ paddingHorizontal: space[5], paddingBottom: space[2] }}>
                  {t('createEvent.previewFeed')}
                </Text>
                <EventCardLarge
                  event={{
                    title: title || t('createEvent.eventName'),
                    category: category || '',
                    date: storageDate(date),
                    time: storageTime(time),
                    images,
                    isFree,
                    price: isFree ? 0 : (parseInt(price) || undefined),
                    location: { name: locationName || (isVirtual ? t('createEvent.virtualEvent') : t('createEvent.noLocation')) },
                    attendees: [],
                    savedBy: [],
                  }}
                  variant="large"
                  onPress={() => {}}
                />
              </View>
            </>
          )}
        </ScrollView>

        {/* ── BARRA DE ACCIÓN FIJA (§ 1.5: contraste + razón) ────────── */}
        <View style={[styles.actionBar, { paddingBottom: Math.max(space[4], insets.bottom), borderTopColor: colors['border.subtle'], backgroundColor: colors['bg.base'] }]}>
          {/* Razón por la que está deshabilitado */}
          {!stepIsValid && step === 2 && !isVirtual && !locationCoords && (
            <Text variant="caption" color="text.tertiary" align="center" style={{ marginBottom: space[2] }}>
              {t('createEvent.missingLocation')}
            </Text>
          )}
          {!stepIsValid && step === 2 && isVirtual && !virtualLink && (
            <Text variant="caption" color="text.tertiary" align="center" style={{ marginBottom: space[2] }}>
              {t('createEvent.missingLink')}
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
                <Text variant="label" color="link">{t('createEvent.done')}</Text>
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
                <Text variant="label" color="link">{t('createEvent.done')}</Text>
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
              {locationCoords ? t('createEvent.locationSelectedMove') : t('createEvent.tapMapToMark')}
            </Text>
            <Pressable
              onPress={() => locationCoords ? setShowMapModal(false) : Alert.alert('', t('createEvent.selectPoint'))}
              style={[styles.ctaBtn, { backgroundColor: locationCoords ? colors['action.primary'] : colors['bg.surface'], marginTop: space[3] }]}
            >
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: locationCoords ? colors['text.onAction'] : colors['text.tertiary'] }}>
                {t('createEvent.confirmLocation')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <VerifyEmailSheet
        visible={showVerify}
        reason="publish"
        onClose={() => setShowVerify(false)}
        onVerified={() => handlePublish()}
      />
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

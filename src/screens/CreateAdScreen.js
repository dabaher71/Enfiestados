// CreateAdScreen — Crear anuncio
// § 2.1: tokens. § 2.2: CTA amarillo, chips amarillos. § 2.3: fechas con selector.
// § 2.4: presupuesto + alcance. § 2.5: "Anuncio" en lugar de "Creatividad".
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal,
  Platform, Pressable, ScrollView, StyleSheet, TextInput, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db, storage } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { createAd } from '../services/adService';
import InternalAdCard from '../components/InternalAdCard';
import { CATEGORIES as ALL_CATEGORIES } from '../constants/categories';

import Text from '../components/ui/Text';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';

const PROVINCES    = ['Toda Costa Rica', 'San José', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste', 'Puntarenas', 'Limón'];
const CATEGORIES   = ALL_CATEGORIES;
const CTA_OPTIONS  = ['Ver más', 'Asistir', 'Comprar', 'Visitar'];
const STEPS        = ['Objetivo', 'Audiencia', 'Anuncio'];   // "Creatividad" → "Anuncio" (§ 2.5)
const BUDGETS      = [1000, 2500, 5000, 10000];              // colones por día
const DAYS_OPTIONS = [7, 14, 30];

const DAYS_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MONTHS  = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function humanDate(d) { return `${DAYS_ES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; }

export default function CreateAdScreen({ navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [step,        setStep]        = useState(0);
  const [type,        setType]        = useState('');
  const [province,    setProvince]    = useState('Toda Costa Rica');
  const [category,    setCategory]    = useState('');
  const [startDate,   setStartDate]   = useState(new Date());
  const [durationDays,setDurationDays]= useState(7);
  const [budgetDay,   setBudgetDay]   = useState(2500);
  const [image,       setImage]       = useState('');
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [ctaLabel,    setCtaLabel]    = useState('Ver más');
  const [targetUrl,   setTargetUrl]   = useState('');
  const [uploading,   setUploading]   = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const userId  = auth.currentUser?.uid;
  const endDate = new Date(startDate); endDate.setDate(endDate.getDate() + durationDays);
  const totalBudget = budgetDay * durationDays;
  // Alcance estimado (ficticio hasta integrar backend de alcance)
  const reachLow  = Math.round(budgetDay * 0.36);
  const reachHigh = Math.round(budgetDay * 0.56);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [16, 9], quality: 0.8,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const uri = result.assets[0].uri;
      const res  = await fetch(uri);
      const blob = await res.blob();
      const storageRef = ref(storage, `ads/${userId}/${Date.now()}.jpg`);
      await uploadBytes(storageRef, blob);
      setImage(await getDownloadURL(storageRef));
    } catch { Alert.alert('Error', 'No se pudo subir la imagen.'); }
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!title.trim()) { Alert.alert('Falta el título'); return; }
    if (!image) { Alert.alert('Falta la imagen'); return; }
    if (type === 'external' && !targetUrl.trim()) { Alert.alert('Falta el link'); return; }
    setSubmitting(true);
    try {
      const userSnap = await getDoc(doc(db, 'users', userId));
      const advertiserName = userSnap.data()?.name || 'Anunciante';
      await createAd(userId, advertiserName, {
        type, title: title.trim(), description: description.trim(),
        image, ctaLabel, targetUrl: targetUrl.trim(),
        province: province === 'Toda Costa Rica' ? null : province,
        category: category || null,
        startDate, endDate, budgetDay,
      });
      Alert.alert('¡Anuncio enviado!', 'Tu anuncio está en revisión. Te avisamos en 24-48 horas.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch { Alert.alert('Error', 'No se pudo crear el anuncio.'); }
    setSubmitting(false);
  };

  const canNext = () => {
    if (step === 0) return !!type;
    if (step === 1) return true;
    return true;
  };

  const previewAd = { id: 'preview', advertiserName: auth.currentUser?.displayName || 'Tu negocio', type, title: title || 'Título de tu anuncio', description, image, ctaLabel, targetUrl };

  // ─── helpers de UI ─────────────────────────────────────────────────────────

  const Chip = ({ label, active, onPress }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      style={[styles.chip, { backgroundColor: active ? colors['action.primary'] : colors['bg.surface'], borderColor: active ? colors['action.primary'] : colors['border.strong'] }]}
    >
      <Text style={{ fontSize: 13, fontFamily: active ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium', color: active ? colors['text.onAction'] : colors['text.secondary'] }}>
        {label}
      </Text>
    </Pressable>
  );

  const FieldLabel = ({ label }) => (
    <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors['text.secondary'], marginBottom: space[2], marginTop: space[4] }}>
      {label}
    </Text>
  );

  const Input = ({ value, onChangeText, placeholder, multiline, keyboardType }) => (
    <TextInput
      style={[
        styles.input,
        { backgroundColor: colors['bg.surface'], color: colors['text.primary'], borderColor: colors['border.strong'], fontFamily: 'PlusJakartaSans_400Regular' },
        multiline && styles.inputMultiline,
      ]}
      placeholder={placeholder}
      placeholderTextColor={colors['text.tertiary']}
      value={value}
      onChangeText={onChangeText}
      multiline={multiline}
      keyboardType={keyboardType}
      autoCapitalize="none"
    />
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors['border.subtle'] }]}>
          <Pressable onPress={() => step === 0 ? navigation.goBack() : setStep(s => s - 1)} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color={colors['text.primary']} />
          </Pressable>
          <Text variant="h2" style={{ flex: 1 }}>Crear anuncio</Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressRow}>
          <Text variant="caption" color="text.tertiary">Paso {step + 1} de {STEPS.length}</Text>
          <View style={[styles.progTrack, { backgroundColor: colors['bg.surface'] }]}>
            <View style={[styles.progFill, { width: `${((step + 1) / STEPS.length) * 100}%`, backgroundColor: colors['action.primary'] }]} />
          </View>
          <Text variant="caption" color="text.tertiary">{STEPS[step]}</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>

          {/* ── STEP 0: Objetivo ─────────────────────────────────── */}
          {step === 0 && (
            <>
              <Text style={[styles.stepTitle, { color: colors['text.primary'], fontFamily: 'BricolageGrotesque_700Bold' }]}>
                ¿Qué querés promocionar?
              </Text>
              {[
                { value: 'event',    icon: 'calendar-outline',   title: 'Mi evento', desc: 'Promové un evento en Enfiestados. Los usuarios pueden asistir desde el anuncio.' },
                { value: 'external', icon: 'globe-outline',      title: 'Mi negocio o link', desc: 'Dirigí a los usuarios a tu sitio web, Instagram, menú o cualquier enlace externo.' },
              ].map(opt => {
                const active = type === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setType(opt.value)}
                    style={[styles.objectiveCard, { backgroundColor: colors['bg.surface'], borderColor: active ? colors['action.primary'] : 'transparent' }]}
                  >
                    <View style={[styles.objectiveIcon, { backgroundColor: active ? `${colors['action.primary']}22` : colors['bg.raised'] }]}>
                      <Ionicons name={opt.icon} size={26} color={active ? colors['action.primary'] : colors['text.tertiary']} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="title">{opt.title}</Text>
                      <Text variant="caption" color="text.secondary" style={{ marginTop: 3 }}>{opt.desc}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={22} color={colors['action.primary']} />}
                  </Pressable>
                );
              })}
            </>
          )}

          {/* ── STEP 1: Audiencia + presupuesto (§ 2.3, 2.4) ──────── */}
          {step === 1 && (
            <>
              <Text style={[styles.stepTitle, { color: colors['text.primary'], fontFamily: 'BricolageGrotesque_700Bold' }]}>
                ¿A quién querés llegar?
              </Text>

              <FieldLabel label="Provincia" />
              <View style={styles.chipGrid}>
                {PROVINCES.map(p => <Chip key={p} label={p} active={province === p} onPress={() => setProvince(p)} />)}
              </View>

              <FieldLabel label="Categoría de interés · opcional" />
              <View style={styles.chipGrid}>
                {CATEGORIES.map(c => <Chip key={c.id} label={c.name} active={category === c.id} onPress={() => setCategory(prev => prev === c.id ? '' : c.id)} />)}
              </View>

              {/* Fecha inicio — selector nativo, no texto manual (§ 2.3) */}
              <FieldLabel label="Fecha de inicio" />
              <Pressable
                onPress={() => setShowDatePicker(true)}
                style={[styles.pickerRow, { backgroundColor: colors['bg.surface'], borderColor: colors['border.strong'] }]}
              >
                <Ionicons name="calendar-outline" size={20} color={colors['text.tertiary']} />
                <Text style={{ flex: 1, fontSize: 16, fontFamily: 'PlusJakartaSans_400Regular', color: colors['text.primary'] }}>
                  {humanDate(startDate)}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors['text.tertiary']} />
              </Pressable>
              {Platform.OS === 'android' && showDatePicker && (
                <DateTimePicker value={startDate} mode="date" display="default" minimumDate={new Date()}
                  onChange={(_, d) => { setShowDatePicker(false); if (d) setStartDate(d); }} />
              )}

              {/* Duración — chips de días (§ 2.3) */}
              <FieldLabel label="Duración" />
              <View style={styles.chipGrid}>
                {DAYS_OPTIONS.map(d => (
                  <Chip key={d} label={`${d} días`} active={durationDays === d} onPress={() => setDurationDays(d)} />
                ))}
              </View>
              <Text variant="caption" color="text.tertiary" style={{ marginTop: space[1] }}>
                Termina el {humanDate(endDate)}
              </Text>

              {/* Presupuesto — chips con valor grande (§ 2.4) */}
              <FieldLabel label="Presupuesto diario" />
              <View style={styles.chipGrid}>
                {BUDGETS.map(b => (
                  <Chip key={b} label={`₡${b.toLocaleString('es-CR')}`} active={budgetDay === b} onPress={() => setBudgetDay(b)} />
                ))}
              </View>

              {/* Alcance estimado + total (§ 2.4) */}
              <View style={[styles.reachCard, { backgroundColor: colors['bg.surface'] }]}>
                <View style={styles.reachRow}>
                  <Text variant="caption" color="text.tertiary">Alcance estimado por día</Text>
                  <Text variant="title">{reachLow.toLocaleString('es-CR')}–{reachHigh.toLocaleString('es-CR')} personas</Text>
                </View>
                <View style={[styles.reachDivider, { backgroundColor: colors['border.subtle'] }]} />
                <View style={styles.reachRow}>
                  <Text variant="caption" color="text.tertiary">Total estimado</Text>
                  <Text variant="title" style={{ color: colors['action.primary'] }}>
                    ₡{totalBudget.toLocaleString('es-CR')}
                  </Text>
                </View>
                <Text variant="caption" color="text.tertiary" style={{ marginTop: space[2] }}>
                  Se cobra solo lo que se consume · podés pausar en cualquier momento.
                </Text>
              </View>
            </>
          )}

          {/* ── STEP 2: Anuncio (antes "Creatividad") (§ 2.5) ─────── */}
          {step === 2 && (
            <>
              <Text style={[styles.stepTitle, { color: colors['text.primary'], fontFamily: 'BricolageGrotesque_700Bold' }]}>
                Diseñá tu anuncio
              </Text>

              <FieldLabel label="Imagen · recomendado 16:9" />
              <Pressable onPress={pickImage} disabled={uploading} style={[styles.imagePicker, { backgroundColor: colors['bg.surface'] }]}>
                {image ? (
                  <Image source={{ uri: image }} style={styles.imagePreview} contentFit="cover" />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name={uploading ? 'cloud-upload-outline' : 'image-outline'} size={32} color={colors['text.tertiary']} />
                    <Text variant="caption" color="text.tertiary">
                      {uploading ? 'Subiendo…' : 'Tocar para seleccionar imagen'}
                    </Text>
                  </View>
                )}
              </Pressable>

              <FieldLabel label={`Título · ${title.length}/40`} />
              <Input value={title} onChangeText={t => setTitle(t.slice(0, 40))} placeholder="Ej: ¡Gran fiesta este sábado!" />

              <FieldLabel label={`Descripción · ${description.length}/90`} />
              <Input value={description} onChangeText={t => setDescription(t.slice(0, 90))} placeholder="Ej: Música en vivo, barra libre, entrada gratis." multiline />

              <FieldLabel label="Botón de llamada a la acción" />
              <View style={styles.chipGrid}>
                {CTA_OPTIONS.map(cta => <Chip key={cta} label={cta} active={ctaLabel === cta} onPress={() => setCtaLabel(cta)} />)}
              </View>

              {type === 'external' && (
                <>
                  <FieldLabel label="Link de destino" />
                  <Input value={targetUrl} onChangeText={setTargetUrl} placeholder="https://…" keyboardType="url" />
                </>
              )}

              <Text variant="overline" color="text.tertiary" style={{ marginTop: space[6], marginBottom: space[3] }}>
                VISTA PREVIA
              </Text>
              <InternalAdCard ad={previewAd} />
            </>
          )}
        </ScrollView>

        {/* Footer CTA — amarillo (§ 2.2) */}
        <View style={[styles.footer, { borderTopColor: colors['border.subtle'], paddingBottom: Math.max(space[4], insets.bottom) }]}>
          <Pressable
            onPress={step < STEPS.length - 1 ? () => setStep(s => s + 1) : handleSubmit}
            disabled={!canNext() || submitting}
            style={[styles.ctaBtn, { backgroundColor: canNext() && !submitting ? colors['action.primary'] : colors['bg.surface'] }]}
          >
            <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: canNext() && !submitting ? colors['text.onAction'] : colors['text.secondary'] }}>
              {step < STEPS.length - 1 ? 'Siguiente' : (submitting ? 'Enviando…' : 'Enviar para revisión')}
            </Text>
            {!submitting && canNext() && (
              <Ionicons name={step < STEPS.length - 1 ? 'arrow-forward' : 'checkmark'} size={18} color={colors['text.onAction']} />
            )}
          </Pressable>
        </View>

        {/* Modal date picker iOS */}
        {Platform.OS === 'ios' && (
          <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
            <Pressable style={styles.pickerOverlay} onPress={() => setShowDatePicker(false)} />
            <View style={[styles.pickerSheet, { backgroundColor: colors['bg.raised'] }]}>
              <View style={[styles.pickerHeader, { borderBottomColor: colors['border.subtle'] }]}>
                <Pressable onPress={() => setShowDatePicker(false)} style={{ padding: space[2] }}>
                  <Text variant="label" color="link">Listo</Text>
                </Pressable>
              </View>
              <DateTimePicker value={startDate} mode="date" display="spinner" minimumDate={new Date()}
                onChange={(_, d) => { if (d) setStartDate(d); }}
                themeVariant={colors['bg.base'] === '#17131F' ? 'dark' : 'light'} />
            </View>
          </Modal>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[5], paddingVertical: space[4], gap: space[3], borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  progressRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[5], paddingVertical: space[3], gap: space[3] },
  progTrack:   { flex: 1, height: 6, borderRadius: radius.full, overflow: 'hidden' },
  progFill:    { height: '100%', borderRadius: radius.full },
  scroll:      { paddingHorizontal: space[5], paddingBottom: space[4] },
  stepTitle:   { fontSize: 24, lineHeight: 30, marginBottom: space[5] },

  objectiveCard: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: radius.lg, padding: space[4], marginBottom: space[3], gap: space[3], borderWidth: 2 },
  objectiveIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  chipGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip:        { paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: radius.full, borderWidth: 1.5, height: 42, justifyContent: 'center', alignItems: 'center' },

  pickerRow:   { height: 56, borderRadius: radius.md, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[3], gap: space[2] },

  reachCard:   { borderRadius: radius.lg, padding: space[4], marginTop: space[4], gap: space[3] },
  reachRow:    { gap: 2 },
  reachDivider:{ height: StyleSheet.hairlineWidth },

  input:       { height: 56, borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: space[3], fontSize: 15 },
  inputMultiline: { height: 88, paddingTop: space[3], textAlignVertical: 'top' },

  imagePicker:  { borderRadius: radius.lg, overflow: 'hidden', marginBottom: space[2] },
  imagePreview: { width: '100%', aspectRatio: 16/9 },
  imagePlaceholder: { height: 140, alignItems: 'center', justifyContent: 'center', gap: space[2] },

  footer:    { paddingHorizontal: space[5], paddingTop: space[3], borderTopWidth: StyleSheet.hairlineWidth },
  ctaBtn:    { height: 56, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2] },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  pickerSheet:   { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, overflow: 'hidden' },
  pickerHeader:  { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space[5], paddingVertical: space[3], borderBottomWidth: StyleSheet.hairlineWidth },
});

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db, storage } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { createAd } from '../services/adService';
import InternalAdCard from '../components/InternalAdCard';
import { CATEGORIES as ALL_CATEGORIES } from '../constants/categories';

const PROVINCES = ['Toda Costa Rica', 'San José', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste', 'Puntarenas', 'Limón'];
const CATEGORIES = ALL_CATEGORIES; // objetos { id, name, icon, color }
const CTA_OPTIONS = ['Ver más', 'Asistir', 'Comprar', 'Visitar'];

const STEPS = ['Objetivo', 'Audiencia', 'Creatividad'];

export default function CreateAdScreen({ navigation }) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState('');          // 'event' | 'external'
  const [province, setProvince] = useState('Toda Costa Rica');
  const [category, setCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [image, setImage] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ctaLabel, setCtaLabel] = useState('Ver más');
  const [targetUrl, setTargetUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const userId = auth.currentUser?.uid;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const uri = result.assets[0].uri;
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `ads/${userId}/${Date.now()}.jpg`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      setImage(url);
    } catch {
      Alert.alert('Error', 'No se pudo subir la imagen.');
    } finally {
      setUploading(false);
    }
  };

  const parseDate = (str) => {
    const [d, m, y] = str.split('/');
    return new Date(+y, +m - 1, +d);
  };

  const handleSubmit = async () => {
    if (!title.trim()) { Alert.alert('Falta el título'); return; }
    if (!image) { Alert.alert('Falta la imagen'); return; }
    if (!startDate || !endDate) { Alert.alert('Falta las fechas'); return; }
    if (type === 'external' && !targetUrl.trim()) { Alert.alert('Falta el link'); return; }

    setSubmitting(true);
    try {
      const userSnap = await getDoc(doc(db, 'users', userId));
      const advertiserName = userSnap.data()?.name || 'Anunciante';
      await createAd(userId, advertiserName, {
        type,
        title: title.trim(),
        description: description.trim(),
        image,
        ctaLabel,
        targetUrl: targetUrl.trim(),
        province: province === 'Toda Costa Rica' ? null : province,
        category: category || null,
        startDate: parseDate(startDate),
        endDate: parseDate(endDate),
      });
      Alert.alert(
        '¡Anuncio enviado!',
        'Tu anuncio está en revisión. Te notificaremos cuando sea aprobado (24-48 horas).',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch {
      Alert.alert('Error', 'No se pudo crear el anuncio.');
    } finally {
      setSubmitting(false);
    }
  };

  const canNext = () => {
    if (step === 0) return !!type;
    if (step === 1) return !!startDate && !!endDate;
    return true;
  };

  const previewAd = {
    id: 'preview',
    advertiserName: auth.currentUser?.displayName || 'Tu negocio',
    type,
    title: title || 'Título de tu anuncio',
    description: description || 'Descripción de tu anuncio aquí.',
    image,
    ctaLabel,
    targetUrl,
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => step === 0 ? navigation.goBack() : setStep(s => s - 1)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Crear anuncio</Text>
        </View>

        {/* Progress */}
        <View style={styles.progressRow}>
          {STEPS.map((s, i) => (
            <View key={s} style={styles.progressItem}>
              <View style={[styles.progressDot, i <= step && styles.progressDotActive]}>
                {i < step ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : (
                  <Text style={styles.progressDotText}>{i + 1}</Text>
                )}
              </View>
              <Text style={[styles.progressLabel, i <= step && styles.progressLabelActive]}>{s}</Text>
              {i < STEPS.length - 1 && (
                <View style={[styles.progressLine, i < step && styles.progressLineActive]} />
              )}
            </View>
          ))}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* STEP 0 — Objetivo */}
          {step === 0 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>¿Qué querés promocionar?</Text>
              <TouchableOpacity
                style={[styles.objectiveCard, type === 'event' && styles.objectiveCardActive]}
                onPress={() => setType('event')}
              >
                <View style={[styles.objectiveIcon, type === 'event' && styles.objectiveIconActive]}>
                  <Ionicons name="calendar" size={28} color={type === 'event' ? '#fff' : '#6c5ce7'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.objectiveTitle}>Mi evento</Text>
                  <Text style={styles.objectiveDesc}>Promové un evento creado en Enfiestados. Los usuarios podrán ver todos los detalles y asistir directamente.</Text>
                </View>
                {type === 'event' && <Ionicons name="checkmark-circle" size={22} color="#6c5ce7" />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.objectiveCard, type === 'external' && styles.objectiveCardActive]}
                onPress={() => setType('external')}
              >
                <View style={[styles.objectiveIcon, type === 'external' && styles.objectiveIconActive]}>
                  <Ionicons name="globe" size={28} color={type === 'external' ? '#fff' : '#6c5ce7'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.objectiveTitle}>Mi negocio o link</Text>
                  <Text style={styles.objectiveDesc}>Dirigí a los usuarios a tu sitio web, Instagram, menú o cualquier enlace externo.</Text>
                </View>
                {type === 'external' && <Ionicons name="checkmark-circle" size={22} color="#6c5ce7" />}
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 1 — Audiencia */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>¿A quién querés llegar?</Text>

              <Text style={styles.fieldLabel}>Provincia</Text>
              <View style={styles.chipGrid}>
                {PROVINCES.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.chip, province === p && styles.chipActive]}
                    onPress={() => setProvince(p)}
                  >
                    <Text style={[styles.chipText, province === p && styles.chipTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Categoría de interés (opcional)</Text>
              <View style={styles.chipGrid}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, category === c.id && styles.chipActive]}
                    onPress={() => setCategory(prev => prev === c.id ? '' : c.id)}
                  >
                    <Text style={[styles.chipText, category === c.id && styles.chipTextActive]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Fecha de inicio (DD/MM/AAAA)</Text>
              <TextInput
                style={styles.input}
                placeholder="01/06/2025"
                placeholderTextColor="#555"
                value={startDate}
                onChangeText={setStartDate}
                keyboardType="numeric"
              />

              <Text style={styles.fieldLabel}>Fecha de fin (DD/MM/AAAA)</Text>
              <TextInput
                style={styles.input}
                placeholder="15/06/2025"
                placeholderTextColor="#555"
                value={endDate}
                onChangeText={setEndDate}
                keyboardType="numeric"
              />
            </View>
          )}

          {/* STEP 2 — Creatividad */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Diseñá tu anuncio</Text>

              {/* Imagen */}
              <Text style={styles.fieldLabel}>Imagen del anuncio</Text>
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage} disabled={uploading}>
                {image ? (
                  <Image source={{ uri: image }} style={styles.imagePreview} contentFit="cover" />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name={uploading ? 'cloud-upload' : 'image'} size={36} color="#555" />
                    <Text style={styles.imagePlaceholderText}>
                      {uploading ? 'Subiendo...' : 'Toca para seleccionar imagen (16:9)'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Título ({title.length}/40)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: ¡Gran fiesta este sábado!"
                placeholderTextColor="#555"
                value={title}
                onChangeText={t => setTitle(t.slice(0, 40))}
              />

              <Text style={styles.fieldLabel}>Descripción ({description.length}/90)</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Ej: Música en vivo, barra libre, entrada gratis antes de las 10pm."
                placeholderTextColor="#555"
                value={description}
                onChangeText={t => setDescription(t.slice(0, 90))}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.fieldLabel}>Botón de llamada a la acción</Text>
              <View style={styles.chipGrid}>
                {CTA_OPTIONS.map(cta => (
                  <TouchableOpacity
                    key={cta}
                    style={[styles.chip, ctaLabel === cta && styles.chipActive]}
                    onPress={() => setCtaLabel(cta)}
                  >
                    <Text style={[styles.chipText, ctaLabel === cta && styles.chipTextActive]}>{cta}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {type === 'external' && (
                <>
                  <Text style={styles.fieldLabel}>Link de destino</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="https://..."
                    placeholderTextColor="#555"
                    value={targetUrl}
                    onChangeText={setTargetUrl}
                    keyboardType="url"
                    autoCapitalize="none"
                  />
                </>
              )}

              {/* Preview en vivo */}
              <Text style={styles.previewLabel}>Vista previa</Text>
              <InternalAdCard ad={previewAd} />
            </View>
          )}
        </ScrollView>

        {/* Footer con botón de avance */}
        <View style={styles.footer}>
          {step < 2 ? (
            <TouchableOpacity
              style={[styles.nextBtn, !canNext() && styles.nextBtnDisabled]}
              onPress={() => setStep(s => s + 1)}
              disabled={!canNext()}
            >
              <Text style={styles.nextBtnText}>Siguiente</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextBtn, submitting && styles.nextBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Text style={styles.nextBtnText}>{submitting ? 'Enviando...' : 'Enviar para revisión'}</Text>
              {!submitting && <Ionicons name="checkmark" size={20} color="#fff" />}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 15,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  progressItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDotActive: { backgroundColor: '#6c5ce7' },
  progressDotText: { color: '#888', fontSize: 12, fontWeight: 'bold' },
  progressLabel: { color: '#555', fontSize: 11, marginLeft: 6 },
  progressLabelActive: { color: '#fff' },
  progressLine: { flex: 1, height: 2, backgroundColor: '#2d2d44', marginHorizontal: 6 },
  progressLineActive: { backgroundColor: '#6c5ce7' },
  stepContent: { paddingHorizontal: 20, paddingBottom: 20 },
  stepTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  objectiveCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  objectiveCardActive: { borderColor: '#6c5ce7' },
  objectiveIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  objectiveIconActive: { backgroundColor: '#6c5ce7' },
  objectiveTitle: { color: '#fff', fontWeight: 'bold', fontSize: 15, marginBottom: 4 },
  objectiveDesc: { color: '#888', fontSize: 13, lineHeight: 19 },
  fieldLabel: { color: '#aaa', fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 18 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2d2d44',
    borderWidth: 1,
    borderColor: '#3d3d54',
  },
  chipActive: { backgroundColor: '#6c5ce7', borderColor: '#6c5ce7' },
  chipText: { color: '#aaa', fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  input: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 15,
  },
  inputMultiline: { height: 90, textAlignVertical: 'top', paddingTop: 12 },
  imagePicker: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#2d2d44',
    marginBottom: 4,
  },
  imagePreview: { width: '100%', height: 180 },
  imagePlaceholder: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  imagePlaceholderText: { color: '#555', fontSize: 13 },
  previewLabel: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6c5ce7',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
  },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

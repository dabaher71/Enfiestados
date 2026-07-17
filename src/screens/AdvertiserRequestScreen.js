import { Ionicons } from '@expo/vector-icons';
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
import { auth } from '../config/firebase';
import { submitAdvertiserRequest } from '../services/adService';

const BUSINESS_TYPES = [
  'Bar / Discoteca',
  'Restaurante / Café',
  'Entretenimiento',
  'Música / Artista',
  'Deportes',
  'Moda / Estilo',
  'Tecnología',
  'Otro',
];

const BENEFITS = [
  { icon: 'trending-up', text: 'Llegá a miles de usuarios en Costa Rica' },
  { icon: 'people', text: 'Segmentá por provincia e intereses' },
  { icon: 'bar-chart', text: 'Métricas en tiempo real: impresiones y clicks' },
  { icon: 'calendar', text: 'Promové tus eventos directamente en el feed' },
];

export default function AdvertiserRequestScreen({ navigation }) {
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!businessName.trim() || !businessType || !contact.trim()) {
      Alert.alert('Campos requeridos', 'Completá todos los campos para continuar.');
      return;
    }
    setLoading(true);
    try {
      const userId = auth.currentUser?.uid;
      await submitAdvertiserRequest(userId, { businessName: businessName.trim(), businessType, contact: contact.trim() });
      Alert.alert(
        '¡Solicitud enviada!',
        'Revisaremos tu solicitud y te notificaremos cuando tu cuenta de anunciante esté activa.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo enviar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Publicitar en Enfiestados</Text>
          </View>

          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="megaphone" size={40} color="#6c5ce7" />
            </View>
            <Text style={styles.heroTitle}>Llegá a tu audiencia ideal</Text>
            <Text style={styles.heroSubtitle}>
              Mostrá tus anuncios directamente en el feed de miles de personas que buscan eventos en Costa Rica.
            </Text>
          </View>

          {/* Beneficios */}
          <View style={styles.benefitsSection}>
            {BENEFITS.map((b, i) => (
              <View key={i} style={styles.benefitRow}>
                <View style={styles.benefitIcon}>
                  <Ionicons name={b.icon} size={20} color="#6c5ce7" />
                </View>
                <Text style={styles.benefitText}>{b.text}</Text>
              </View>
            ))}
          </View>

          {/* Formulario */}
          <View style={styles.form}>
            <Text style={styles.formTitle}>Solicitá tu cuenta de anunciante</Text>

            <Text style={styles.label}>Nombre del negocio o marca</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: La Cueva Bar"
              placeholderTextColor="#555"
              value={businessName}
              onChangeText={setBusinessName}
            />

            <Text style={styles.label}>Tipo de negocio</Text>
            <View style={styles.typeGrid}>
              {BUSINESS_TYPES.map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, businessType === type && styles.typeChipActive]}
                  onPress={() => setBusinessType(type)}
                >
                  <Text style={[styles.typeChipText, businessType === type && styles.typeChipTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>WhatsApp o correo de contacto</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: +506 8888-8888"
              placeholderTextColor="#555"
              value={contact}
              onChangeText={setContact}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.submitBtnText}>
                {loading ? 'Enviando...' : 'Enviar solicitud'}
              </Text>
              {!loading && <Ionicons name="arrow-forward" size={20} color="#fff" />}
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              Al enviar aceptás los términos de publicidad de Enfiestados. Revisaremos tu solicitud en 24-48 horas.
            </Text>
          </View>
        </ScrollView>
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
    paddingBottom: 15,
    gap: 15,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  hero: { alignItems: 'center', paddingHorizontal: 30, paddingVertical: 24 },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  heroSubtitle: { color: '#aaa', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  benefitsSection: { paddingHorizontal: 20, marginBottom: 8 },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 14,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitText: { color: '#ddd', fontSize: 14, flex: 1 },
  form: { paddingHorizontal: 20, paddingBottom: 40 },
  formTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 20, marginTop: 10 },
  label: { color: '#aaa', fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 15,
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2d2d44',
    borderWidth: 1,
    borderColor: '#3d3d54',
  },
  typeChipActive: { backgroundColor: '#6c5ce7', borderColor: '#6c5ce7' },
  typeChipText: { color: '#aaa', fontSize: 13 },
  typeChipTextActive: { color: '#fff', fontWeight: '600' },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6c5ce7',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 28,
    gap: 10,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  disclaimer: { color: '#555', fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 18 },
});

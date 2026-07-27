// AdvertiserRequestScreen — Publicitar en Enfiestados
// § 2.1: tokens. § 2.2: CTA amarillo, chips seleccionados en amarillo.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../config/firebase';
import { submitAdvertiserRequest } from '../services/adService';

import Text from '../components/ui/Text';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';

const BUSINESS_TYPES = [
  'Bar / Discoteca', 'Restaurante / Café', 'Entretenimiento',
  'Música / Artista', 'Deportes', 'Moda / Estilo', 'Tecnología', 'Otro',
];

const BENEFITS = [
  { icon: 'trending-up',  text: 'Llegá a miles de usuarios en Costa Rica' },
  { icon: 'people',       text: 'Segmentá por provincia e intereses' },
  { icon: 'bar-chart',    text: 'Métricas en tiempo real: impresiones y clics' },
  { icon: 'calendar',     text: 'Promové tus eventos directamente en el feed' },
];

export default function AdvertiserRequestScreen({ navigation }) {
  const { colors } = useTheme();
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [contact,      setContact]      = useState('');
  const [loading,      setLoading]      = useState(false);

  const canSubmit = businessName.trim() && businessType && contact.trim() && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
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
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: space[16] }}>

          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Volver">
              <Ionicons name="arrow-back" size={24} color={colors['text.primary']} />
            </Pressable>
            <Text variant="h2">Publicitar en Enfiestados</Text>
          </View>

          {/* Hero */}
          <View style={styles.hero}>
            <View style={[styles.heroIcon, { backgroundColor: `${colors['action.primary']}22` }]}>
              <Ionicons name="megaphone-outline" size={36} color={colors['action.primary']} />
            </View>
            <Text style={[styles.heroTitle, { color: colors['text.primary'], fontFamily: 'BricolageGrotesque_700Bold' }]}>
              Llegá a tu audiencia ideal
            </Text>
            <Text variant="body" color="text.secondary" align="center" style={{ paddingHorizontal: space[4] }}>
              Mostrá tus anuncios directamente en el feed de miles de personas que buscan eventos en Costa Rica.
            </Text>
          </View>

          {/* Beneficios */}
          <View style={styles.benefitsSection}>
            {BENEFITS.map((b, i) => (
              <View key={i} style={[styles.benefitRow, { backgroundColor: colors['bg.surface'] }]}>
                <View style={[styles.benefitIcon, { backgroundColor: `${colors['nav.selected']}18` }]}>
                  <Ionicons name={b.icon} size={18} color={colors['nav.selected']} />
                </View>
                <Text variant="body" color="text.secondary" style={{ flex: 1 }}>{b.text}</Text>
              </View>
            ))}
          </View>

          {/* Formulario */}
          <View style={styles.form}>
            <Text variant="h3" style={{ marginBottom: space[4] }}>Solicitá tu cuenta de anunciante</Text>

            <Text variant="label" color="text.secondary" style={{ marginBottom: space[2] }}>Nombre del negocio o marca</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors['bg.surface'], color: colors['text.primary'], borderColor: colors['border.strong'], fontFamily: 'PlusJakartaSans_400Regular' }]}
              placeholder="Ej: La Cueva Bar"
              placeholderTextColor={colors['text.tertiary']}
              value={businessName}
              onChangeText={setBusinessName}
            />

            <Text variant="label" color="text.secondary" style={{ marginBottom: space[2], marginTop: space[4] }}>Tipo de negocio</Text>
            <View style={styles.chipGrid}>
              {BUSINESS_TYPES.map(type => {
                const active = businessType === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => setBusinessType(type)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    style={[
                      styles.typeChip,
                      {
                        backgroundColor: active ? colors['action.primary'] : colors['bg.surface'],
                        borderColor:     active ? colors['action.primary'] : colors['border.strong'],
                      },
                    ]}
                  >
                    <Text style={{
                      fontSize: 13,
                      fontFamily: active ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium',
                      color: active ? colors['text.onAction'] : colors['text.secondary'],
                    }}>
                      {type}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text variant="label" color="text.secondary" style={{ marginBottom: space[2], marginTop: space[4] }}>
              WhatsApp o correo de contacto
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors['bg.surface'], color: colors['text.primary'], borderColor: colors['border.strong'], fontFamily: 'PlusJakartaSans_400Regular' }]}
              placeholder="Ej: +506 8888-8888"
              placeholderTextColor={colors['text.tertiary']}
              value={contact}
              onChangeText={setContact}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* CTA — amarillo (§ 2.2) */}
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={[
                styles.submitBtn,
                { backgroundColor: canSubmit ? colors['action.primary'] : colors['bg.surface'] },
              ]}
              accessibilityRole="button"
            >
              <Text style={{
                fontSize: 16,
                fontFamily: 'PlusJakartaSans_700Bold',
                color: canSubmit ? colors['text.onAction'] : colors['text.secondary'],
              }}>
                {loading ? 'Enviando…' : 'Enviar solicitud'}
              </Text>
              {!loading && canSubmit && <Ionicons name="arrow-forward" size={18} color={colors['text.onAction']} />}
            </Pressable>

            <Text variant="caption" color="text.tertiary" align="center" style={{ marginTop: space[4] }}>
              Al enviar aceptás los términos de publicidad de Enfiestados. Revisaremos tu solicitud en 24–48 horas.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[5], paddingVertical: space[4], gap: space[3] },
  back:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hero:   { alignItems: 'center', paddingHorizontal: space[8], paddingVertical: space[6], gap: space[4] },
  heroIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 22, lineHeight: 28, textAlign: 'center' },
  benefitsSection: { paddingHorizontal: space[5], gap: space[3], marginBottom: space[4] },
  benefitRow: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, padding: space[4], gap: space[3] },
  benefitIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  form: { paddingHorizontal: space[5] },
  input: { height: 56, borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: space[3], fontSize: 15 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  typeChip: { paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: radius.full, borderWidth: 1.5, height: 42, justifyContent: 'center', alignItems: 'center' },
  submitBtn: { height: 56, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2], marginTop: space[6] },
});

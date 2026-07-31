// InterestsScreen — Onboarding de gustos en 3 pasos (§ 8b, 8c, 8d)
// En modo edición (onboarding: false) muestra solo el paso 1.
// Lógica INTACTA: save a Firestore, navigate.replace / goBack.
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { CATEGORIES } from '../constants/categories';
import Text from '../components/ui/Text';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';

const MIN_INTERESTS = 3;

const PROVINCES = [
  'San José', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste', 'Puntarenas', 'Limón',
];
const RADII = [5, 10, 15, 20, 30, 50];

export default function InterestsScreen({ navigation, route }) {
  const { colors } = useTheme();
  const isOnboarding = route?.params?.onboarding !== false;

  const [step,     setStep]     = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [province, setProvince] = useState('');
  const [radius_,  setRadius_]  = useState(15);
  const [saving,   setSaving]   = useState(false);

  const totalSteps = isOnboarding ? 3 : 1;

  useEffect(() => {
    const load = async () => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        const snap = await getDoc(doc(db, 'users', userId));
        const data = snap.data() ?? {};
        if (data.interests?.length) setSelected(new Set(data.interests));
        if (data.location) setProvince(data.location);
      } catch {}
    };
    load();
  }, []);

  const toggle = id => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const step1Valid = selected.size >= MIN_INTERESTS;
  const step2Valid = province !== '';
  const step3Valid = true; // permisos son opcionales

  const stepValid = [step1Valid, step2Valid, step3Valid][step - 1] ?? true;

  const handleNext = async () => {
    if (step < totalSteps) { setStep(s => s + 1); return; }
    // Último paso: guardar
    setSaving(true);
    try {
      const userId = auth.currentUser?.uid;
      await updateDoc(doc(db, 'users', userId), {
        interests: Array.from(selected),
        location: province,
      });
      if (isOnboarding) navigation.replace('MainApp');
      else navigation.goBack();
    } catch {
      Alert.alert('Error', 'No se pudo guardar. Intentá de nuevo.');
      setSaving(false);
    }
  };

  const requestNotifPermission = async () => {
    try { await Notifications.requestPermissionsAsync(); } catch {}
  };

  const requestLocationPermission = async () => {
    try { await Location.requestForegroundPermissionsAsync(); } catch {}
  };

  const stepTitles = [
    '¿Qué te gusta?',
    '¿Dónde estás?',
    'Un último paso',
  ];
  const stepSubtitles = [
    'Elegí al menos 3 categorías para personalizar tu feed.',
    'Elegí tu zona para ver eventos cerca de vos.',
    'Estos permisos mejoran tu experiencia, pero son opcionales.',
  ];
  const continueLabel = step === totalSteps
    ? (saving ? 'Guardando…' : isOnboarding ? 'Listo, mostrá los eventos' : 'Guardar')
    : 'Continuar';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]} edges={['top', 'bottom']}>

      {/* ── HEADER: progreso ─────────────────────────────────────── */}
      <View style={styles.topBar}>
        {(!isOnboarding || step > 1) ? (
          <Pressable
            onPress={() => step > 1 ? setStep(s => s - 1) : navigation.goBack()}
            style={styles.iconBtn}
            accessibilityLabel="Volver"
          >
            <Ionicons name="arrow-back" size={22} color={colors['text.primary']} />
          </Pressable>
        ) : <View style={styles.iconBtn} />}

        <View style={{ flex: 1, gap: space[2] }}>
          {totalSteps > 1 && (
            <>
              <Text variant="caption" color="text.tertiary" align="center">
                Paso {step} de {totalSteps}
              </Text>
              <View style={[styles.progTrack, { backgroundColor: colors['bg.surface'] }]}>
                <View style={[styles.progFill, { width: `${(step / totalSteps) * 100}%`, backgroundColor: colors['action.primary'] }]} />
              </View>
            </>
          )}
        </View>

        {isOnboarding && (
          <Pressable
            onPress={() => navigation.replace('MainApp')}
            style={styles.iconBtn}
            accessibilityRole="link"
          >
            <Text variant="caption" color="text.tertiary">Omitir</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Título del paso ───────────────────────────────────── */}
        <Text style={[styles.stepTitle, { color: colors['text.primary'], fontFamily: 'BricolageGrotesque_700Bold' }]}>
          {stepTitles[step - 1]}
        </Text>
        <Text variant="body" color="text.secondary" style={{ marginBottom: space[5] }}>
          {stepSubtitles[step - 1]}
        </Text>

        {/* ── PASO 1: Categorías ───────────────────────────────── */}
        {step === 1 && (
          <>
            <Text variant="caption" color={step1Valid ? 'status.free' : 'nav.selected'} style={{ marginBottom: space[3] }}>
              {selected.size} elegidas · mínimo {MIN_INTERESTS}
            </Text>
            <View style={styles.grid}>
              {CATEGORIES.map(cat => {
                const isSelected = selected.has(cat.id);
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => toggle(cat.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    style={[
                      styles.catCard,
                      { backgroundColor: isSelected ? `${cat.color}28` : colors['bg.surface'], borderColor: isSelected ? cat.color : colors['border.subtle'] },
                    ]}
                  >
                    <View style={[styles.catIcon, { backgroundColor: isSelected ? `${cat.color}33` : colors['bg.raised'] }]}>
                      <Ionicons name={cat.icon} size={24} color={isSelected ? cat.color : colors['text.tertiary']} />
                    </View>
                    <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: isSelected ? colors['text.primary'] : colors['text.secondary'], textAlign: 'center' }}>
                      {cat.name}
                    </Text>
                    {isSelected && (
                      <View style={[styles.checkBadge, { backgroundColor: cat.color }]}>
                        <Ionicons name="checkmark" size={11} color="#fff" />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* ── PASO 2: Zona + radio ─────────────────────────────── */}
        {step === 2 && (
          <>
            <Text variant="overline" color="text.tertiary" style={{ marginBottom: space[3] }}>PROVINCIA</Text>
            <View style={styles.chipGrid}>
              {PROVINCES.map(p => {
                const active = province === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => setProvince(p)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    hitSlop={1}
                    style={[
                      styles.chip,
                      { backgroundColor: active ? colors['action.primary'] : colors['bg.surface'], borderColor: active ? colors['action.primary'] : colors['border.strong'] },
                    ]}
                  >
                    <Text style={{ fontSize: 14, fontFamily: active ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium', color: active ? colors['text.onAction'] : colors['text.secondary'] }}>
                      {p}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text variant="overline" color="text.tertiary" style={{ marginTop: space[5], marginBottom: space[3] }}>
              RADIO DE BÚSQUEDA · {radius_} km
            </Text>
            <View style={styles.chipGrid}>
              {RADII.map(r => {
                const active = radius_ === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setRadius_(r)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    hitSlop={1}
                    style={[
                      styles.chip,
                      { backgroundColor: active ? colors['action.primary'] : colors['bg.surface'], borderColor: active ? colors['action.primary'] : colors['border.strong'] },
                    ]}
                  >
                    <Text style={{ fontSize: 14, fontFamily: active ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium', color: active ? colors['text.onAction'] : colors['text.secondary'] }}>
                      {r} km
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* ── PASO 3: Permisos ─────────────────────────────────── */}
        {step === 3 && (
          <View style={styles.permsContainer}>
            {/* Notificaciones */}
            <Pressable
              onPress={requestNotifPermission}
              style={[styles.permCard, { backgroundColor: colors['bg.surface'] }]}
              accessibilityRole="button"
            >
              <View style={[styles.permIcon, { backgroundColor: `${colors['action.primary']}22` }]}>
                <Ionicons name="notifications-outline" size={26} color={colors['action.primary']} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="title">Notificaciones</Text>
                <Text variant="caption" color="text.tertiary" style={{ marginTop: 3 }}>
                  Para avisarte cuando hay algo nuevo que te puede interesar.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors['text.tertiary']} />
            </Pressable>

            {/* Ubicación */}
            <Pressable
              onPress={requestLocationPermission}
              style={[styles.permCard, { backgroundColor: colors['bg.surface'] }]}
              accessibilityRole="button"
            >
              <View style={[styles.permIcon, { backgroundColor: `${colors['nav.selected']}22` }]}>
                <Ionicons name="location-outline" size={26} color={colors['nav.selected']} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="title">Ubicación</Text>
                <Text variant="caption" color="text.tertiary" style={{ marginTop: 3 }}>
                  Para mostrarte eventos cerca de donde estás.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors['text.tertiary']} />
            </Pressable>

            <Text variant="caption" color="text.tertiary" align="center" style={{ marginTop: space[4] }}>
              Podés cambiar estos permisos en cualquier momento desde Configuración.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── BARRA DE ACCIÓN ─────────────────────────────────────── */}
      <View style={[styles.footer, { borderTopColor: colors['border.subtle'] }]}>
        <Pressable
          onPress={handleNext}
          disabled={!stepValid || saving}
          style={[
            styles.ctaBtn,
            { backgroundColor: stepValid && !saving ? colors['action.primary'] : colors['action.primary.disabled'] },
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !stepValid || saving }}
        >
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: stepValid && !saving ? colors['text.onAction'] : colors['text.tertiary'] }}>
            {continueLabel}
          </Text>
          {step < totalSteps && stepValid && (
            <Ionicons name="chevron-forward" size={18} color={colors['text.onAction']} />
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    gap: space[4],
    flexShrink: 0,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  progTrack: { height: 6, borderRadius: radius.full, overflow: 'hidden' },
  progFill:  { height: '100%', borderRadius: radius.full },

  scroll: { paddingHorizontal: space[5], paddingBottom: space[4] },

  stepTitle: { fontSize: 28, lineHeight: 34, marginBottom: space[2] },

  // Paso 1 — Categorías
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    justifyContent: 'space-between',
  },
  catCard: {
    width: '47%',
    borderRadius: radius.lg,
    padding: space[4],
    alignItems: 'center',
    gap: space[2],
    borderWidth: 2,
    position: 'relative',
  },
  catIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: space[2],
    right: space[2],
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Paso 2 — Zona
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: {
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.md,
    borderWidth: 1.5,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Paso 3 — Permisos
  permsContainer: { gap: space[4] },
  permCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: space[4],
    gap: space[3],
  },
  permIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Footer
  footer: {
    paddingHorizontal: space[5],
    paddingTop: space[3],
    paddingBottom: space[5],
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
});

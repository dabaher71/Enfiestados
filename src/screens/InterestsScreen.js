import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { CATEGORIES } from '../constants/categories';

const MIN_INTERESTS = 3;

export default function InterestsScreen({ navigation, route }) {
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const isOnboarding = route?.params?.onboarding !== false;

  // Cargar intereses existentes al abrir la pantalla
  useEffect(() => {
    const load = async () => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        const snap = await getDoc(doc(db, 'users', userId));
        const interests = snap.data()?.interests ?? [];
        if (interests.length > 0) setSelected(new Set(interests));
      } catch {}
    };
    load();
  }, []);

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (selected.size < MIN_INTERESTS) {
      Alert.alert('Seleccioná más', `Elegí al menos ${MIN_INTERESTS} intereses para continuar.`);
      return;
    }
    setSaving(true);
    try {
      const userId = auth.currentUser?.uid;
      await updateDoc(doc(db, 'users', userId), {
        interests: Array.from(selected),
      });
      if (isOnboarding) {
        navigation.replace('MainApp');
      } else {
        navigation.goBack();
      }
    } catch {
      Alert.alert('Error', 'No se pudo guardar. Intentá de nuevo.');
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        {!isOnboarding && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        )}

        <View style={styles.header}>
          <Text style={styles.title}>
            {isOnboarding ? '¿Qué te apasiona?' : 'Mis intereses'}
          </Text>
          <Text style={styles.subtitle}>
            {isOnboarding
              ? 'Elegí tus intereses y te mostraremos eventos y anuncios a tu medida.'
              : 'Actualizá tus intereses para mejorar tu feed.'}
          </Text>
          <Text style={styles.hint}>
            Seleccioná al menos {MIN_INTERESTS} · {selected.size} elegidos
          </Text>
        </View>

        {/* Grid de categorías */}
        <View style={styles.grid}>
          {CATEGORIES.map(cat => {
            const isSelected = selected.has(cat.id);
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.card,
                  isSelected && { borderColor: cat.color, borderWidth: 2 },
                ]}
                onPress={() => toggle(cat.id)}
                activeOpacity={0.8}
              >
                {/* Fondo coloreado cuando está seleccionado */}
                <View style={[
                  styles.iconWrap,
                  { backgroundColor: isSelected ? cat.color : '#3d3d54' },
                ]}>
                  <Ionicons
                    name={cat.icon}
                    size={26}
                    color={isSelected ? '#fff' : '#aaa'}
                  />
                </View>

                <Text style={[styles.cardName, isSelected && { color: '#fff' }]}>
                  {cat.name}
                </Text>

                {isSelected && (
                  <View style={[styles.checkBadge, { backgroundColor: cat.color }]}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Footer fijo */}
      <View style={styles.footer}>
        <View style={styles.progressBar}>
          <View style={[
            styles.progressFill,
            { width: `${Math.min(100, (selected.size / MIN_INTERESTS) * 100)}%` },
          ]} />
        </View>
        <TouchableOpacity
          style={[
            styles.btn,
            selected.size < MIN_INTERESTS && styles.btnDisabled,
            saving && styles.btnDisabled,
          ]}
          onPress={handleSave}
          disabled={selected.size < MIN_INTERESTS || saving}
        >
          <Text style={styles.btnText}>
            {saving ? 'Guardando...' : isOnboarding ? 'Empezar' : 'Guardar'}
          </Text>
          {!saving && <Ionicons name="arrow-forward" size={20} color="#fff" />}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  scroll: { paddingHorizontal: 20, paddingBottom: 20 },
  backBtn: { paddingTop: 10, paddingBottom: 4 },
  header: { marginTop: 16, marginBottom: 24 },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { color: '#aaa', fontSize: 15, lineHeight: 22, marginBottom: 10 },
  hint: { color: '#6c5ce7', fontSize: 13, fontWeight: '600' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  card: {
    width: '47%',
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardName: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
    gap: 12,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#2d2d44',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6c5ce7',
    borderRadius: 2,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6c5ce7',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

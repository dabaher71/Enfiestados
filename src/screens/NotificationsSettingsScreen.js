// NotificationsSettingsScreen — subpantalla de tipos de notificación (§ 7.4)
// Reemplaza el switch único en Configuración por 3 tipos separados.
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SwitchRow } from '../components/ui/Controls';
import Text from '../components/ui/Text';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';

const STORAGE_KEY = '@enfiestados/notif_prefs';

const NOTIF_TYPES = [
  {
    id: 'social',
    icon: 'heart-outline',
    label: 'Actividad social',
    description: 'Likes, comentarios y nuevos seguidores.',
  },
  {
    id: 'reminders',
    icon: 'alarm-outline',
    label: 'Recordatorios de eventos',
    description: 'Te avisamos 24 horas antes de un evento guardado.',
  },
  {
    id: 'tickets',
    icon: 'ticket-outline',
    label: 'Entradas y compras',
    description: 'Confirmaciones y actualizaciones de tus entradas.',
  },
];

export default function NotificationsSettingsScreen({ navigation }) {
  const { colors } = useTheme();
  const [prefs, setPrefs] = useState({ social: true, reminders: true, tickets: true });

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => { if (raw) setPrefs(JSON.parse(raw)); })
      .catch(() => {});
  }, []);

  const toggle = async (id) => {
    const updated = { ...prefs, [id]: !prefs[id] };
    setPrefs(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
  };

  const activeCount = Object.values(prefs).filter(Boolean).length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={colors['text.primary']} />
        </Pressable>
        <Text variant="h2">Notificaciones</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space[16] }}>
        <Text variant="body" color="text.secondary" style={styles.intro}>
          Elegí qué tipos de notificaciones querés recibir.
          {' '}
          <Text variant="bodyStrong">{activeCount} de {NOTIF_TYPES.length} activas.</Text>
        </Text>

        <View style={[styles.section, { backgroundColor: colors['bg.surface'] }]}>
          {NOTIF_TYPES.map(type => (
            <SwitchRow
              key={type.id}
              label={type.label}
              description={type.description}
              value={prefs[type.id] ?? true}
              onValueChange={() => toggle(type.id)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1 },
  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[5], paddingVertical: space[4], gap: space[3] },
  back:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  intro:   { paddingHorizontal: space[5], paddingBottom: space[4] },
  section: { marginHorizontal: space[5], borderRadius: 16, overflow: 'hidden' },
});

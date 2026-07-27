// Mis planes — Voy · Guardados · Entradas
// Placeholder Fase 4: estructura y estados implementados; contenido en Fase 5.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EmptyState from '../components/ui/EmptyState';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import Text from '../components/ui/Text';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';

const TABS = [
  { label: 'Voy', value: 'voy' },
  { label: 'Guardados', value: 'guardados' },
  { label: 'Entradas', value: 'entradas' },
];

const EMPTIES = {
  voy: {
    icon: 'calendar-outline',
    title: 'Todavía no vas a nada',
    desc: 'Guardá los planes que te gusten y aparecen acá con recordatorio.',
    action: 'Explorar este finde',
  },
  guardados: {
    icon: 'bookmark-outline',
    title: 'Sin guardados todavía',
    desc: 'Tocá el marcador en cualquier evento para guardarlo acá.',
    action: 'Explorar eventos',
  },
  entradas: {
    icon: 'ticket-outline',
    title: 'Sin entradas',
    desc: 'Tus entradas compradas aparecen acá con el código QR.',
    action: 'Explorar eventos',
  },
};

export default function MyPlansScreen({ navigation }) {
  const { colors } = useTheme();
  const [tab, setTab] = useState('voy');
  const empty = EMPTIES[tab];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      <View style={styles.header}>
        <Text variant="h2">Mis planes</Text>
      </View>
      <View style={[styles.tabs, { borderBottomColor: colors['border.subtle'] }]}>
        <SegmentedControl options={TABS} selected={tab} onSelect={setTab} />
      </View>
      <EmptyState
        icon={<Ionicons name={empty.icon} size={28} color={colors['text.tertiary']} />}
        title={empty.title}
        description={empty.desc}
        actionLabel={empty.action}
        onAction={() => navigation.navigate('Home')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  header: { paddingHorizontal: space[5], paddingVertical: space[4] },
  tabs:   { paddingHorizontal: space[5], paddingBottom: space[3], borderBottomWidth: StyleSheet.hairlineWidth },
});

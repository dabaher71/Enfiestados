// Solo visible en __DEV__. Muestra todas las variantes de la librería de componentes.
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Avatar, { AvatarStack } from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import { CheckboxRow, RadioRow, SwitchRow } from '../components/ui/Controls';
import Dialog from '../components/ui/Dialog';
import EmptyState from '../components/ui/EmptyState';
import Input, { SearchField, TextArea } from '../components/ui/Input';
import { StepProgress, ProgressBar } from '../components/ui/Progress';
import { SegmentedControl, UnderlineTabs } from '../components/ui/SegmentedControl';
import Sheet from '../components/ui/Sheet';
import Skeleton, { SkeletonEventRow, SkeletonList } from '../components/ui/Skeleton';
import { showSnackbar } from '../components/ui/Snackbar';
import StatusBadge from '../components/ui/StatusBadge';
import Text from '../components/ui/Text';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { useState } from 'react';

function Section({ title, children }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, { borderTopColor: colors['border.subtle'] }]}>
      <Text variant="overline" color="text.tertiary" style={{ marginBottom: space[3] }}>{title}</Text>
      {children}
    </View>
  );
}

export default function DevCatalogScreen() {
  const { colors, isDark, mode, setThemeMode } = useTheme();
  const [checked, setChecked] = useState(false);
  const [radioVal, setRadioVal] = useState('a');
  const [switchVal, setSwitchVal] = useState(true);
  const [seg, setSeg] = useState('todos');
  const [tab, setTab] = useState('eventos');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [inputVal, setInputVal] = useState('');

  if (!__DEV__) return null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="display" style={{ marginBottom: space[6] }}>Catálogo de componentes</Text>

        {/* Tema */}
        <Section title="Tema">
          <View style={styles.row}>
            {['system', 'dark', 'light'].map(m => (
              <Button key={m} variant={mode === m ? 'primary' : 'secondary'} size="sm" label={m} onPress={() => setThemeMode(m)} />
            ))}
          </View>
        </Section>

        {/* Tipografía */}
        <Section title="Tipografía">
          {['display','h1','h2','h3','title','subtitle','body','bodyStrong','label','caption','overline','tabLabel'].map(v => (
            <Text key={v} variant={v} style={{ marginBottom: space[2] }}>{v} — El plan perfecto para este finde</Text>
          ))}
        </Section>

        {/* Botones */}
        <Section title="Button">
          <View style={styles.col}>
            {['primary','secondary','ghost','destructive'].map(v => (
              <Button key={v} variant={v} size="lg" label={v} onPress={() => {}} fullWidth />
            ))}
            <Button variant="primary" size="lg" label="Cargando…" loading fullWidth />
            <Button variant="primary" size="lg" label="Deshabilitado" disabled fullWidth />
          </View>
          <View style={[styles.row, { marginTop: space[3] }]}>
            <Button variant="icon" size="icon" leadingIcon={<Ionicons name="heart-outline" size={20} color={colors['text.primary']} />} onPress={() => {}} accessibilityLabel="Guardar" />
            <Button variant="primary" size="sm" label="sm" onPress={() => {}} />
            <Button variant="secondary" size="md" label="md" onPress={() => {}} />
          </View>
        </Section>

        {/* Chips y Badges */}
        <Section title="Chip + StatusBadge">
          <View style={styles.row}>
            <Chip label="Todos" selected onPress={() => {}} />
            <Chip label="Hoy" onPress={() => {}} />
            <Chip label="Gratis" onPress={() => {}} />
          </View>
          <View style={[styles.row, { marginTop: space[3] }]}>
            <StatusBadge label="GRATIS"    variant="free" />
            <StatusBadge label="ÚLTIMAS"   variant="urgent" />
            <StatusBadge label="MÚSICA"    variant="neutral" />
            <StatusBadge label="PATROCINADO" variant="promo" />
          </View>
        </Section>

        {/* Inputs */}
        <Section title="Input / TextArea / SearchField">
          <Input label="Nombre del evento" placeholder="Ej. Festival de la Luz" value={inputVal} onChangeText={setInputVal} style={{ marginBottom: space[3] }} />
          <Input label="Con error" placeholder="Ingresá tu correo" value="" onChangeText={() => {}} errorText="Este campo es requerido" style={{ marginBottom: space[3] }} />
          <TextArea label="Descripción" placeholder="Contá de qué trata el evento…" value="" onChangeText={() => {}} maxLength={500} style={{ marginBottom: space[3] }} />
          <SearchField placeholder="Buscar eventos…" value="" onChangeText={() => {}} />
        </Section>

        {/* Controls */}
        <Section title="Switch / Checkbox / Radio">
          <SwitchRow label="Notificaciones push" description="Recibís alertas de tus eventos" value={switchVal} onValueChange={setSwitchVal} />
          <CheckboxRow label="Acepto los términos" checked={checked} onPress={() => setChecked(v => !v)} />
          {['a','b','c'].map(v => (
            <RadioRow key={v} label={`Opción ${v.toUpperCase()}`} selected={radioVal === v} onPress={() => setRadioVal(v)} />
          ))}
        </Section>

        {/* Avatar */}
        <Section title="Avatar + AvatarStack">
          <View style={styles.row}>
            {[26, 32, 40, 56, 88].map(s => (
              <Avatar key={s} name="David Barrantes" size={s} />
            ))}
          </View>
          <View style={[styles.row, { marginTop: space[3] }]}>
            <AvatarStack names={['Ana','Beto','Carmen','Diego','Elena']} size={36} max={3} />
          </View>
        </Section>

        {/* SegmentedControl + Tabs */}
        <Section title="SegmentedControl + UnderlineTabs">
          <SegmentedControl
            options={[{ label: 'Para vos', value: 'todos' }, { label: 'Siguiendo', value: 'sig' }]}
            selected={seg}
            onSelect={setSeg}
          />
          <View style={{ marginTop: space[4] }}>
            <UnderlineTabs
              options={[{ label: 'Eventos', value: 'eventos' }, { label: 'Publicaciones', value: 'posts' }, { label: 'Fotos', value: 'fotos' }]}
              selected={tab}
              onSelect={setTab}
            />
          </View>
        </Section>

        {/* Skeleton */}
        <Section title="Skeleton">
          <SkeletonList count={3} />
        </Section>

        {/* EmptyState */}
        <Section title="EmptyState">
          <EmptyState
            icon={<Ionicons name="calendar-outline" size={28} color={colors['text.tertiary']} />}
            title="Todavía no vas a nada"
            description="Guardá los planes que te gusten y aparecen acá con recordatorio."
            actionLabel="Explorar este finde"
            onAction={() => {}}
          />
        </Section>

        {/* Progress */}
        <Section title="StepProgress + ProgressBar">
          <StepProgress current={2} total={3} />
          <ProgressBar value={65} style={{ marginTop: space[3] }} />
        </Section>

        {/* Snackbar */}
        <Section title="Snackbar">
          <View style={styles.col}>
            <Button variant="secondary" size="sm" label="Mostrar snackbar" onPress={() => showSnackbar({ message: 'Evento guardado en Mis planes' })} />
            <Button variant="secondary" size="sm" label="Con acción" onPress={() => showSnackbar({ message: 'Evento guardado', actionLabel: 'Ver', action: () => {} })} />
          </View>
        </Section>

        {/* Sheet */}
        <Section title="Sheet">
          <Button variant="secondary" size="sm" label="Abrir Sheet half" onPress={() => setSheetVisible(true)} />
          <Sheet visible={sheetVisible} onClose={() => setSheetVisible(false)} height="half" title="Compartir evento">
            <View style={{ padding: space[5] }}>
              <Text variant="body" color="text.secondary">Contenido del sheet…</Text>
            </View>
          </Sheet>
        </Section>

        {/* Dialog */}
        <Section title="Dialog">
          <Button variant="destructive" size="sm" label="Abrir Dialog destructivo" onPress={() => setDialogVisible(true)} />
          <Dialog
            visible={dialogVisible}
            title="¿Eliminar evento?"
            message="Esta acción no se puede deshacer. Los asistentes recibirán una notificación."
            confirmLabel="Eliminar"
            cancelLabel="Cancelar"
            destructive
            onConfirm={() => setDialogVisible(false)}
            onCancel={() => setDialogVisible(false)}
          />
        </Section>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1 },
  scroll:  { padding: space[5], paddingBottom: space[16] },
  section: { paddingTop: space[6], borderTopWidth: StyleSheet.hairlineWidth },
  row:     { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  col:     { gap: space[2] },
});

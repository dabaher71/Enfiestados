// SettingsScreen — Configuración
// LÓGICA INTACTA: logout, navegación a subpantallas.
// PRESENTACIÓN: design system v1.1 — MetaRow, SwitchRow, Dialog, tokens.
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';
import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import Text from '../components/ui/Text';

import { auth } from '../config/firebase';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import t from '../i18n/es-CR.json';
import Constants from 'expo-constants';

const NOTIF_KEY = '@enfiestados/notif_prefs';

export default function SettingsScreen({ navigation }) {
  const { colors, mode, setThemeMode } = useTheme();
  const [notifCount,  setNotifCount]  = useState(3);  // "3 de 3" por defecto
  const [showLogout, setShowLogout] = useState(false);

  // Leer preferencias para mostrar el valor actual en la fila
  useState(() => {
    AsyncStorage.getItem(NOTIF_KEY).then(raw => {
      if (raw) {
        const prefs = JSON.parse(raw);
        setNotifCount(Object.values(prefs).filter(Boolean).length);
      }
    }).catch(() => {});
  });

  const handleLogout = async () => {
    try { await signOut(auth); } catch { Alert.alert('Error', 'No se pudo cerrar sesión'); }
    setShowLogout(false);
  };

  const SectionTitle = ({ label }) => (
    <Text variant="overline" color="text.tertiary" style={styles.sectionTitle}>{label}</Text>
  );

  // Cápsula neutra: fondo bg.surface, icono text.secondary.
  // Excepción: destructive → fondo status.urgent al 14%, icono coral.
  // FIX_ROUND_4 § 10.1: rgba(255,255,255,.07) fijo se rompía en tema claro
  // (blanco sobre blanco) — mismo bug que los chips y el segmented control.
  const IconCapsule = ({ icon, destructive = false }) => (
    <View style={[
      styles.iconCapsule,
      { backgroundColor: destructive
          ? `${colors['status.urgent']}24`
          : colors['bg.surface'] },
    ]}>
      <Ionicons
        name={icon}
        size={20}
        color={destructive ? '#FF8078' : colors['text.secondary']}
      />
    </View>
  );

  // Row: título 16/700 text.primary arriba, subtítulo 13.5/500 text.tertiary abajo (§ 7.2)
  const Row = ({ icon, label, subtitle, value, onPress, destructive = false }) => (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, { borderBottomColor: colors['border.subtle'] }]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <IconCapsule icon={icon} destructive={destructive} />
      <View style={styles.rowText}>
        <Text variant="subtitle" style={{ color: destructive ? colors['status.urgent'] : colors['text.primary'] }}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors['text.tertiary'], marginTop: 1 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="caption" color="text.tertiary">{value}</Text>
      ) : null}
      {onPress && (
        <Ionicons name="chevron-forward" size={19} color={colors['text.tertiary']} />
      )}
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={colors['text.primary']} />
        </Pressable>
        <Text variant="h2">{t.settings.title}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space[16] }}>

        {/* Cuenta */}
        <SectionTitle label="CUENTA" />
        <View style={[styles.section, { backgroundColor: colors['bg.surface'] }]}>
          <Row icon="person-outline"    label="Editar perfil"       subtitle="Foto, nombre, biografía"        onPress={() => navigation.navigate('EditProfile', { user: null })} />
          <Row icon="sparkles-outline"  label="Mis intereses"       subtitle="Qué tipo de eventos querés ver"  value="4"          onPress={() => navigation.navigate('Interests', { onboarding: false })} />
          <Row icon="location-outline"  label="Zona y distancia"    subtitle="Región y radio de búsqueda"      value="15 km"      onPress={() => Alert.alert('Zona', 'Próximamente…')} />
          <Row icon="lock-closed-outline" label="Privacidad"        subtitle="Permisos y bloqueos"             onPress={() => Alert.alert('Privacidad', 'Próximamente…')} />
        </View>

        {/* Apariencia */}
        <SectionTitle label="APARIENCIA" />
        <View style={[styles.section, { backgroundColor: colors['bg.surface'] }]}>
          <View style={styles.themeRow}>
            <Text variant="subtitle" style={{ flex: 1 }}>{t.settings.theme.label}</Text>
            <View style={[styles.themeToggle, { backgroundColor: colors['bg.base'] }]}>
              {[
                { value: 'system', icon: 'phone-portrait-outline', label: 'Auto' },
                { value: 'dark',   icon: 'moon-outline',           label: 'Oscuro' },
                { value: 'light',  icon: 'sunny-outline',          label: 'Claro' },
              ].map(opt => (
                <Pressable
                  key={opt.value}
                  onPress={() => setThemeMode(opt.value)}
                  hitSlop={4}
                  style={[
                    styles.themeBtn,
                    mode === opt.value && { backgroundColor: colors['action.primary'] },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: mode === opt.value }}
                  accessibilityLabel={opt.label}
                >
                  <Ionicons
                    name={opt.icon}
                    size={18}
                    color={mode === opt.value ? colors['text.onAction'] : colors['text.tertiary']}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Notificaciones — navega a subpantalla con 3 tipos (§ 7.4) */}
        <SectionTitle label="NOTIFICACIONES" />
        <View style={[styles.section, { backgroundColor: colors['bg.surface'] }]}>
          <Row
            icon="notifications-outline"
            label="Notificaciones push"
            subtitle="Alertas de actividad e interacciones"
            value={`${notifCount} de 3`}
            onPress={() => navigation.navigate('NotificationsSettings')}
          />
        </View>

        {/* Información */}
        <SectionTitle label="INFORMACIÓN" />
        <View style={[styles.section, { backgroundColor: colors['bg.surface'] }]}>
          <Row icon="document-text-outline"    label="Términos y condiciones" onPress={() => Alert.alert('Términos', 'Próximamente…')} />
          <Row icon="shield-checkmark-outline" label="Política de privacidad" onPress={() => Alert.alert('Privacidad', 'Próximamente…')} />
          <Row icon="help-circle-outline"      label="Ayuda y soporte"        onPress={() => Alert.alert('Soporte', 'Escribinos a soporte@enfiestados.com')} />
          <Row icon="information-circle-outline" label="Versión"              value={`${Constants.expoConfig?.version ?? '1.0.0'} Beta`} />
        </View>

        {/* Sesión */}
        <SectionTitle label="SESIÓN" />
        <View style={[styles.section, { backgroundColor: colors['bg.surface'] }]}>
          <Row icon="log-out-outline"  label={t.settings.logout}    destructive onPress={() => setShowLogout(true)} />
          <Row icon="trash-outline"    label="Eliminar cuenta"       destructive onPress={() => Alert.alert('Eliminar cuenta', 'Esta acción es irreversible. Contactá a soporte@enfiestados.com para proceder.')} />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text variant="caption" color="text.tertiary" align="center">Hecho con ☀️ en Costa Rica</Text>
          <Text variant="caption" color="text.tertiary" align="center" style={{ marginTop: 4 }}>© 2026 Enfiestados</Text>
        </View>
      </ScrollView>

      <Dialog
        visible={showLogout}
        title="¿Cerrar sesión?"
        message="Tendrás que volver a iniciar sesión para acceder a tu cuenta."
        confirmLabel={t.settings.logout}
        cancelLabel={t.common.cancel}
        destructive
        onConfirm={handleLogout}
        onCancel={() => setShowLogout(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[5], paddingVertical: space[4] },
  back:         { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { paddingHorizontal: space[5], paddingTop: space[5], paddingBottom: space[2] },
  section:      { marginHorizontal: space[5], borderRadius: 16, overflow: 'hidden' },

  // Row (§ 7.2): cápsula + texto + valor + chevron
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: space[3],
  },
  iconCapsule: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowText: { flex: 1 },

  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    minHeight: 56,
  },
  themeToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    gap: 2,
  },
  themeBtn: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  footer: { paddingVertical: space[8], alignItems: 'center' },
});

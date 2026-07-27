// SettingsScreen — Configuración
// LÓGICA INTACTA: logout, navegación a subpantallas.
// PRESENTACIÓN: design system v1.1 — MetaRow, SwitchRow, Dialog, tokens.
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import MetaRow from '../components/ui/MetaRow';
import { SwitchRow } from '../components/ui/Controls';
import Text from '../components/ui/Text';

import { auth } from '../config/firebase';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import t from '../i18n/es-CR.json';
import Constants from 'expo-constants';

export default function SettingsScreen({ navigation }) {
  const { colors, mode, setThemeMode } = useTheme();
  const [notifs, setNotifs]       = useState(true);
  const [showLogout, setShowLogout] = useState(false);

  const handleLogout = async () => {
    try { await signOut(auth); } catch { Alert.alert('Error', 'No se pudo cerrar sesión'); }
    setShowLogout(false);
  };

  const SectionTitle = ({ label }) => (
    <Text variant="overline" color="text.tertiary" style={styles.sectionTitle}>{label}</Text>
  );

  const Row = ({ icon, iconColor, label, subtitle, onPress, right }) => (
    <MetaRow
      icon={<Ionicons name={icon} size={20} color={iconColor ?? colors['text.secondary']} />}
      label={label}
      value={subtitle ?? ''}
      onPress={onPress}
    />
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
          <Row icon="person-outline" iconColor={colors['nav.selected']} label={t.settings.account} subtitle="Foto, nombre, biografía" onPress={() => navigation.navigate('EditProfile', { user: null })} />
          <Row icon="lock-closed-outline" iconColor={colors['status.info']} label={t.settings.privacy} subtitle="Permisos, bloqueos" onPress={() => Alert.alert('Privacidad', 'Próximamente…')} />
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

        {/* Notificaciones */}
        <SectionTitle label="NOTIFICACIONES" />
        <View style={[styles.section, { backgroundColor: colors['bg.surface'] }]}>
          <SwitchRow
            label="Notificaciones push"
            description="Alertas de actividad e interacciones"
            value={notifs}
            onValueChange={setNotifs}
          />
        </View>

        {/* Información */}
        <SectionTitle label="INFORMACIÓN" />
        <View style={[styles.section, { backgroundColor: colors['bg.surface'] }]}>
          <Row icon="document-text-outline" iconColor={colors['status.warning']} label="Términos y condiciones" onPress={() => Alert.alert('Términos', 'Próximamente…')} />
          <Row icon="shield-checkmark-outline" iconColor={colors['status.free']} label="Política de privacidad" onPress={() => Alert.alert('Privacidad', 'Próximamente…')} />
          <Row icon="help-circle-outline" iconColor={colors['status.info']} label="Ayuda y soporte" onPress={() => Alert.alert('Soporte', 'Escribinos a soporte@enfiestados.com')} />
          <MetaRow
            icon={<Ionicons name="information-circle-outline" size={20} color={colors['text.tertiary']} />}
            label="Versión"
            value={`${Constants.expoConfig?.version ?? '1.0.0'} (Beta)`}
          />
        </View>

        {/* Sesión */}
        <SectionTitle label="SESIÓN" />
        <View style={[styles.section, { backgroundColor: colors['bg.surface'] }]}>
          <Pressable
            onPress={() => setShowLogout(true)}
            style={[styles.logoutRow, { borderBottomColor: colors['border.subtle'] }]}
            accessibilityRole="button"
          >
            <Ionicons name="log-out-outline" size={20} color={colors['status.urgent']} />
            <Text variant="subtitle" style={{ color: colors['status.urgent'], marginLeft: space[3] }}>
              {t.settings.logout}
            </Text>
          </Pressable>
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
  section:      { marginHorizontal: space[5], borderRadius: 16, paddingHorizontal: space[4], overflow: 'hidden' },

  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[3],
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

  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[4],
  },

  footer: { paddingVertical: space[8], alignItems: 'center' },
});

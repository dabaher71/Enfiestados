// SettingsScreen — Configuración
// LÓGICA INTACTA: logout, navegación a subpantallas.
// PRESENTACIÓN: design system v1.1 — MetaRow, SwitchRow, Dialog, tokens.
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';
import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import Input from '../components/ui/Input';
import Sheet from '../components/ui/Sheet';
import Text from '../components/ui/Text';
import LanguagePicker from '../components/LanguagePicker';
import VerifyEmailSheet from '../components/VerifyEmailSheet';
import { LANGUAGES } from '../i18n';

import { auth, functions } from '../config/firebase';
import { needsEmailVerification } from '../lib/emailVerification';
import { useZonePreference } from '../lib/zonePreference';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';

const NOTIF_KEY = '@enfiestados/notif_prefs';
// El sitio vive en enfiestados.net, servido por Firebase Hosting como dominio
// personalizado. Los .web.app y .firebaseapp.com siguen sirviendo lo mismo.
const PRIVACY_URL = 'https://enfiestados.net/privacidad';
const TERMS_URL   = 'https://enfiestados.net/terminos';

export default function SettingsScreen({ navigation }) {
  const { colors, mode, setThemeMode } = useTheme();
  const { t, i18n } = useTranslation();
  const [showLanguage, setShowLanguage] = useState(false);
  const { zone } = useZonePreference();
  const [notifCount,  setNotifCount]  = useState(3);  // "3 de 3" por defecto
  const [showLogout, setShowLogout] = useState(false);

  // Eliminar cuenta: 'closed' → 'confirm' (aviso) → 'code' (pedir/validar código)
  const [deleteStep,    setDeleteStep]    = useState('closed');
  const [deleteCode,    setDeleteCode]    = useState('');
  const [deleteError,   setDeleteError]   = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Verificar correo: solo cuentas con correo y contraseña sin confirmar
  // (Google ya viene verificado). Ver VerifyEmailSheet.
  const [emailVerified, setEmailVerified] = useState(auth.currentUser?.emailVerified ?? true);
  const [showVerify,    setShowVerify]    = useState(false);
  const verifyEmail = auth.currentUser?.isAnonymous ? null : auth.currentUser?.email;

  // Si confirmó con el enlace del correo, el token local sigue diciendo que
  // no: needsEmailVerification() recarga el usuario y refresca el token.
  useEffect(() => {
    needsEmailVerification().then(needs => setEmailVerified(!needs)).catch(() => {});
  }, []);

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
    try { await signOut(auth); } catch { Alert.alert(t('common.error'), t('settings.logoutError')); }
    setShowLogout(false);
  };

  const closeDeleteFlow = () => {
    setDeleteStep('closed');
    setDeleteCode('');
    setDeleteError('');
  };

  const handleRequestDeletionCode = async () => {
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await httpsCallable(functions, 'requestAccountDeletion')();
      setDeleteStep('code');
    } catch (e) {
      Alert.alert(t('common.error'), e?.message || t('settings.codeSendError'));
    }
    setDeleteLoading(false);
  };

  const handleConfirmDeletion = async () => {
    if (deleteCode.length !== 6) { setDeleteError(t('settings.enterSixDigits')); return; }
    setDeleteLoading(true);
    setDeleteError('');
    try {
      // El borrado completo (datos + Storage) puede pasar del timeout por
      // defecto de 70s; la función tiene hasta 300s.
      await httpsCallable(functions, 'confirmAccountDeletion', { timeout: 300000 })({ code: deleteCode });
      closeDeleteFlow();
      await signOut(auth);
      Alert.alert(t('settings.accountDeleted'), t('settings.accountDeletedMsg'));
    } catch (e) {
      setDeleteError(e?.message || t('settings.confirmError'));
    }
    setDeleteLoading(false);
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
        <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel={t('common.back')}>
          <Ionicons name="arrow-back" size={24} color={colors['text.primary']} />
        </Pressable>
        <Text variant="h2">{t('settings.title')}</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* space[4] y no space[16]: esta pantalla es de stack, no tiene tab bar
          que librar, y styles.footer ya aporta 32 de paddingVertical más el
          safe-area inferior. Con space[16] quedaban ~130px muertos abajo. */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space[4] }}>

        {/* Cuenta */}
        <SectionTitle label={t('settings.sections.account')} />
        <View style={[styles.section, { backgroundColor: colors['bg.surface'] }]}>
          {!!verifyEmail && !emailVerified && (
            <Row icon="mail-unread-outline" label={t('settings.verifyEmail')} subtitle={t('settings.verifyEmailSub')} onPress={() => setShowVerify(true)} />
          )}
          <Row icon="person-outline"    label={t('settings.editProfile')} subtitle={t('settings.editProfileSub')}        onPress={() => navigation.navigate('EditProfile', { user: null })} />
          <Row icon="sparkles-outline"  label={t('settings.interests')} subtitle={t('settings.interestsSub')}  value="4"          onPress={() => navigation.navigate('Interests', { onboarding: false })} />
          {/* El valor sale de la zona guardada de verdad (zonePreference);
              sin zona no se muestra ninguno, para no sugerir un radio que no
              está filtrando nada. */}
          <Row icon="location-outline"  label={t('settings.zone')} subtitle={zone ? t('settings.zoneSubPin') : t('settings.zoneSubAll')} value={zone ? `${zone.radiusKm} km` : undefined} onPress={() => navigation.navigate('ZoneSettings')} />
          <Row icon="lock-closed-outline" label={t('settings.blocked')} subtitle={t('settings.blockedSub')} onPress={() => navigation.navigate('BlockedUsers')} />
          <Row icon="language-outline" label={t('settings.language')} value={LANGUAGES.find(l => l.code === i18n.language)?.label} onPress={() => setShowLanguage(true)} />
        </View>

        {/* Apariencia */}
        <SectionTitle label={t('settings.sections.appearance')} />
        <View style={[styles.section, { backgroundColor: colors['bg.surface'] }]}>
          <View style={styles.themeRow}>
            <Text variant="subtitle" style={{ flex: 1 }}>{t('settings.theme.label')}</Text>
            <View style={[styles.themeToggle, { backgroundColor: colors['bg.base'] }]}>
              {[
                { value: 'system', icon: 'phone-portrait-outline', label: t('settings.themeAuto') },
                { value: 'dark',   icon: 'moon-outline',           label: t('settings.theme.dark') },
                { value: 'light',  icon: 'sunny-outline',          label: t('settings.theme.light') },
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
        <SectionTitle label={t('settings.sections.notifications')} />
        <View style={[styles.section, { backgroundColor: colors['bg.surface'] }]}>
          <Row
            icon="notifications-outline"
            label={t('settings.push')}
            subtitle={t('settings.pushSub')}
            value={t('settings.pushCount', { count: notifCount })}
            onPress={() => navigation.navigate('NotificationsSettings')}
          />
        </View>

        {/* Información */}
        <SectionTitle label={t('settings.sections.info')} />
        <View style={[styles.section, { backgroundColor: colors['bg.surface'] }]}>
          <Row icon="document-text-outline"    label={t('settings.terms')} onPress={() => Linking.openURL(TERMS_URL)} />
          <Row icon="shield-checkmark-outline" label={t('settings.privacyPolicy')} onPress={() => Linking.openURL(PRIVACY_URL)} />
          <Row icon="help-circle-outline"      label={t('settings.help')} onPress={() => Alert.alert(t('settings.support'), t('settings.supportMsg'))} />
          <Row icon="information-circle-outline" label={t('settings.version')}              value={`${Constants.expoConfig?.version ?? '1.0.0'} Beta`} />
        </View>

        {/* Sesión */}
        <SectionTitle label={t('settings.sections.session')} />
        <View style={[styles.section, { backgroundColor: colors['bg.surface'] }]}>
          <Row icon="log-out-outline"  label={t('settings.logout')} destructive onPress={() => setShowLogout(true)} />
        </View>

        {/* Footer — eliminar cuenta va acá, discreto: no es una acción que
            queramos invitar a tocar por accidente, pero tiene que ser
            encontrable (requisito de Google Play). */}
        <View style={styles.footer}>
          <Text variant="caption" color="text.tertiary" align="center">© 2026 Enfiestados</Text>
          <Pressable onPress={() => setDeleteStep('confirm')} hitSlop={8} style={{ marginTop: space[6] }}>
            <Text variant="caption" color="text.tertiary" align="center" style={styles.deleteLink}>
              {t('settings.deleteMyAccount')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <Dialog
        visible={showLogout}
        title={t('settings.logoutTitle')}
        message={t('settings.logoutMsg')}
        confirmLabel={t('settings.logout')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={handleLogout}
        onCancel={() => setShowLogout(false)}
      />

      <Sheet visible={deleteStep !== 'closed'} onClose={closeDeleteFlow} height="half" title={t('settings.deleteAccount')}>
        <View style={styles.deleteSheet}>
          {deleteStep === 'confirm' && (
            <>
              <Text variant="body" color="text.secondary">
                {t('settings.deleteIntro')}
              </Text>
              <Button
                variant="destructive"
                size="md"
                label={t('settings.sendCode')}
                loading={deleteLoading}
                onPress={handleRequestDeletionCode}
                style={{ marginTop: space[5] }}
              />
            </>
          )}
          {deleteStep === 'code' && (
            <>
              <Text variant="body" color="text.secondary">
                {t('settings.codeSent')}
              </Text>
              <Input
                label={t('settings.codeLabel')}
                placeholder="000000"
                value={deleteCode}
                onChangeText={v => { setDeleteCode(v.replace(/\D/g, '').slice(0, 6)); setDeleteError(''); }}
                keyboardType="number-pad"
                maxLength={6}
                errorText={deleteError}
                style={{ marginTop: space[4] }}
              />
              <Button
                variant="destructive"
                size="md"
                label={t('settings.deleteForever')}
                loading={deleteLoading}
                onPress={handleConfirmDeletion}
                style={{ marginTop: space[4] }}
              />
              <Pressable onPress={handleRequestDeletionCode} disabled={deleteLoading} style={{ marginTop: space[3], alignSelf: 'center' }}>
                <Text variant="caption" color="text.tertiary">{t('settings.resendCode')}</Text>
              </Pressable>
            </>
          )}
        </View>
      </Sheet>

      <VerifyEmailSheet
        visible={showVerify}
        onClose={() => setShowVerify(false)}
        onVerified={(showAlert) => {
          setEmailVerified(true);
          if (showAlert) Alert.alert(t('settings.verifiedTitle'), t('settings.verifiedMsg'));
        }}
      />

      <Sheet visible={showLanguage} onClose={() => setShowLanguage(false)} height="peek" title={t('settings.language')}>
        <LanguagePicker style={styles.languageSheet} onChange={() => setShowLanguage(false)} />
      </Sheet>
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
  deleteLink: { fontSize: 12, textDecorationLine: 'underline' },
  languageSheet: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[8] },
  deleteSheet: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[8] },
});

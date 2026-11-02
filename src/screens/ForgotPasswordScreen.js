// ForgotPasswordScreen — tokens completos, CTA amarillo, voseo.
import { Ionicons } from '@expo/vector-icons';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../config/firebase';

import Button from '../components/ui/Button';
import Text from '../components/ui/Text';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { useTranslation } from 'react-i18next';

export default function ForgotPasswordScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  const handleReset = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setError(t('auth.enterEmail')); return; }
    setError('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, trimmed);
    } catch {
      // Mensaje genérico — no revelar si el email existe
    } finally {
      setSent(true);
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.content}>

          {/* Botón atrás */}
          <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel={t('common.back')}>
            <Ionicons name="arrow-back" size={24} color={colors['text.primary']} />
          </Pressable>

          {/* Ícono */}
          <View style={[styles.iconCircle, { backgroundColor: `${colors['action.primary']}22` }]}>
            <Ionicons name="lock-open-outline" size={36} color={colors['action.primary']} />
          </View>

          <Text style={[styles.title, { color: colors['text.primary'], fontFamily: 'BricolageGrotesque_700Bold' }]}>
            {t('forgot.title')}
          </Text>
          <Text variant="body" color="text.secondary" align="center" style={styles.subtitle}>
            {t('forgot.subtitle')}
          </Text>

          {sent ? (
            /* Estado de éxito */
            <View style={styles.sentBox}>
              <Ionicons name="checkmark-circle" size={56} color={colors['status.free']} />
              <Text variant="h2" style={{ marginTop: space[4], marginBottom: space[2] }}>{t('forgot.sent')}</Text>
              <Text variant="body" color="text.secondary" align="center" style={{ marginBottom: space[8] }}>
                {t('forgot.sentDesc')}
              </Text>
              <Button
                variant="primary"
                size="lg"
                label={t('forgot.backToLogin')}
                onPress={() => navigation.goBack()}
                fullWidth
              />
            </View>
          ) : (
            <>
              {/* Campo correo */}
              <View style={[styles.inputRow, { backgroundColor: colors['bg.surface'], borderColor: error ? colors['status.urgent'] : colors['border.strong'] }]}>
                <Ionicons name="mail-outline" size={18} color={colors['text.tertiary']} />
                <TextInput
                  style={[styles.input, { color: colors['text.primary'], fontFamily: 'PlusJakartaSans_400Regular' }]}
                  placeholder={t('auth.email')}
                  placeholderTextColor={colors['text.tertiary']}
                  value={email}
                  onChangeText={v => { setEmail(v); setError(''); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoFocus
                />
              </View>
              {error ? <Text variant="caption" color="status.urgent" style={styles.errorText}>{error}</Text> : null}

              <Button
                variant="primary"
                size="lg"
                label={loading ? t('forgot.sending') : t('forgot.sendLink')}
                onPress={handleReset}
                loading={loading}
                fullWidth
                style={{ marginTop: space[4] }}
              />

              <Pressable onPress={() => navigation.goBack()} style={styles.linkBtn} accessibilityRole="link">
                <Text variant="body" color="text.secondary" align="center">
                  {t('forgot.remember')}{' '}
                  <Text variant="bodyStrong" style={{ color: colors['link'] }}>{t('auth.signIn')}</Text>
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1 },
  content: { flex: 1, paddingHorizontal: space[5], paddingTop: space[4] },
  back:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: space[6] },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: space[5] },
  title:   { fontSize: 26, lineHeight: 32, textAlign: 'center', marginBottom: space[2] },
  subtitle:{ marginBottom: space[8] },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: space[3],
    gap: space[2],
  },
  input:     { flex: 1, fontSize: 16 },
  errorText: { marginTop: space[1] },
  linkBtn:   { marginTop: space[5], alignSelf: 'center' },
  sentBox:   { alignItems: 'center', paddingTop: space[4] },
});

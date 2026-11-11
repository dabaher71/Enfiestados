// ForgotPasswordScreen — tokens completos, CTA amarillo, voseo.
// Tres pasos, todo dentro de la app (ver requestPasswordReset y compañía en
// functions/index.js): correo → PIN de 6 dígitos → contraseña nueva. Al
// terminar entra directo con la contraseña nueva.
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, functions } from '../config/firebase';

import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Text from '../components/ui/Text';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { useTranslation } from 'react-i18next';

const STEP_ICONS = { email: 'lock-open-outline', code: 'mail-open-outline', password: 'key-outline' };

export default function ForgotPasswordScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [step,        setStep]        = useState('email'); // email | code | password
  const [email,       setEmail]       = useState('');
  const [code,        setCode]        = useState('');
  const [resetToken,  setResetToken]  = useState('');
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [errors,      setErrors]      = useState({});
  const [notice,      setNotice]      = useState('');

  const trimmedEmail = email.trim().toLowerCase();
  const fail = (field, msg) => setErrors({ [field]: msg });

  const errorFor = (e) => ({
    'functions/resource-exhausted': t('forgot.errTooMany'),
    'functions/deadline-exceeded':  t('forgot.errExpired'),
    'functions/not-found':          t('forgot.errExpired'),
    'functions/permission-denied':  t('forgot.errWrongCode'),
    'functions/invalid-argument':   t('auth.errInvalidEmail'),
  }[e?.code] || t('auth.errUnexpected'));

  const requestCode = async () => {
    if (!trimmedEmail) { fail('email', t('auth.enterEmail')); return; }
    setErrors({});
    setNotice('');
    setLoading(true);
    try {
      await httpsCallable(functions, 'requestPasswordReset')({ email: trimmedEmail });
      // Siempre se pasa al PIN, exista o no la cuenta: la pantalla no puede
      // servir para averiguar quién está registrado.
      if (step === 'code') setNotice(t('forgot.codeResent'));
      setStep('code');
    } catch (e) {
      if (step === 'code') fail('code', errorFor(e));
      else fail('email', errorFor(e));
    }
    setLoading(false);
  };

  const verifyCode = async () => {
    if (code.length !== 6) { fail('code', t('settings.enterSixDigits')); return; }
    setErrors({});
    setNotice('');
    setLoading(true);
    try {
      const { data } = await httpsCallable(functions, 'verifyPasswordResetCode')({ email: trimmedEmail, code });
      setResetToken(data.resetToken);
      setStep('password');
    } catch (e) {
      fail('code', errorFor(e));
    }
    setLoading(false);
  };

  const savePassword = async () => {
    if (password.length < 6) { fail('password', t('auth.passwordMin')); return; }
    if (password !== confirm) { fail('confirm', t('auth.passwordsMismatch')); return; }
    setErrors({});
    setLoading(true);
    try {
      await httpsCallable(functions, 'confirmPasswordReset')({ email: trimmedEmail, resetToken, newPassword: password });
    } catch (e) {
      // Más de 10 minutos en este paso: hay que volver a pedir el PIN.
      if (e?.code === 'functions/deadline-exceeded') {
        setStep('email');
        setCode('');
        fail('email', t('forgot.errSessionExpired'));
      } else {
        fail('password', errorFor(e));
      }
      setLoading(false);
      return;
    }
    try {
      // Con la sesión iniciada, AppNavigator cambia solo a la app.
      await signInWithEmailAndPassword(auth, trimmedEmail, password);
    } catch {
      setLoading(false);
      navigation.goBack();
    }
  };

  const EyeToggle = ({ show, onToggle, label }) => (
    <Pressable onPress={onToggle} accessibilityLabel={label}>
      <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors['text.tertiary']} />
    </Pressable>
  );

  // El atrás vuelve un paso; desde el primero, a Iniciar sesión.
  const goBack = () => {
    setErrors({});
    setNotice('');
    if (step === 'code') { setStep('email'); setCode(''); }
    else if (step === 'password') setStep('code');
    else navigation.goBack();
  };

  const subtitle = {
    email:    t('forgot.subtitle'),
    code:     t('forgot.codeSubtitle', { email: trimmedEmail }),
    password: t('forgot.passwordSubtitle'),
  }[step];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <Pressable onPress={goBack} style={styles.back} accessibilityLabel={t('common.back')}>
            <Ionicons name="arrow-back" size={24} color={colors['text.primary']} />
          </Pressable>

          <View style={[styles.iconCircle, { backgroundColor: `${colors['action.primary']}22` }]}>
            <Ionicons name={STEP_ICONS[step]} size={36} color={colors['action.primary']} />
          </View>

          <Text style={[styles.title, { color: colors['text.primary'], fontFamily: 'BricolageGrotesque_700Bold' }]}>
            {step === 'password' ? t('forgot.newPasswordTitle') : t('forgot.title')}
          </Text>
          <Text variant="body" color="text.secondary" align="center" style={styles.subtitle}>
            {subtitle}
          </Text>

          {step === 'email' && (
            <>
              <Input
                label={t('auth.email')}
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChangeText={v => { setEmail(v); setErrors({}); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus
                errorText={errors.email}
                leadingIcon={<Ionicons name="mail-outline" size={18} color={colors['text.tertiary']} />}
              />
              <Button
                variant="primary"
                size="lg"
                label={loading ? t('forgot.sending') : t('forgot.sendCode')}
                onPress={requestCode}
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

          {step === 'code' && (
            <>
              <Input
                label={t('settings.codeLabel')}
                placeholder="000000"
                value={code}
                onChangeText={v => { setCode(v.replace(/\D/g, '').slice(0, 6)); setErrors({}); }}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                errorText={errors.code}
                leadingIcon={<Ionicons name="keypad-outline" size={18} color={colors['text.tertiary']} />}
              />
              <Button
                variant="primary"
                size="lg"
                label={t('forgot.verifyCode')}
                onPress={verifyCode}
                loading={loading}
                fullWidth
                style={{ marginTop: space[4] }}
              />
              {notice ? (
                <Text variant="caption" color="text.secondary" align="center" style={{ marginTop: space[3] }}>{notice}</Text>
              ) : null}
              <Pressable onPress={requestCode} disabled={loading} style={styles.linkBtn}>
                <Text variant="body" color="text.secondary" align="center">
                  {t('forgot.noCode')}{' '}
                  <Text variant="bodyStrong" style={{ color: colors['link'] }}>{t('forgot.resend')}</Text>
                </Text>
              </Pressable>
            </>
          )}

          {step === 'password' && (
            <>
              <Input
                label={t('forgot.newPassword')}
                placeholder={t('auth.passwordMin')}
                value={password}
                onChangeText={v => { setPassword(v); setErrors({}); }}
                secureTextEntry={!showPass}
                autoCapitalize="none"
                autoFocus
                errorText={errors.password}
                leadingIcon={<Ionicons name="lock-closed-outline" size={18} color={colors['text.tertiary']} />}
                trailingIcon={<EyeToggle show={showPass} onToggle={() => setShowPass(v => !v)} label={t('auth.showPassword')} />}
              />
              <Input
                label={t('forgot.confirmNewPassword')}
                placeholder={t('auth.confirmPlaceholder')}
                value={confirm}
                onChangeText={v => { setConfirm(v); setErrors({}); }}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                errorText={errors.confirm}
                leadingIcon={<Ionicons name="shield-checkmark-outline" size={18} color={colors['text.tertiary']} />}
                trailingIcon={<EyeToggle show={showConfirm} onToggle={() => setShowConfirm(v => !v)} label={t('auth.showConfirm')} />}
                style={{ marginTop: space[3] }}
              />
              <Button
                variant="primary"
                size="lg"
                label={t('forgot.savePassword')}
                onPress={savePassword}
                loading={loading}
                fullWidth
                style={{ marginTop: space[4] }}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: space[5], paddingTop: space[4], paddingBottom: space[8] },
  back:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: space[6] },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: space[5] },
  title:   { fontSize: 26, lineHeight: 32, textAlign: 'center', marginBottom: space[2] },
  subtitle:{ marginBottom: space[8] },
  linkBtn: { marginTop: space[5], alignSelf: 'center' },
});

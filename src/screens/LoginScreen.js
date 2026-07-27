// LoginScreen — Bienvenida / Login
// LÓGICA INTACTA: email+pass, Google Sign-In, navegación a Register/ForgotPassword.
// PRESENTACIÓN: design system v1.1 — Input, Button, tokens.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { signInAnonymously, signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Text from '../components/ui/Text';

import { auth } from '../config/firebase';
import { signInWithGoogle } from '../services/googleAuthService';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import t from '../i18n/es-CR.json';

export default function LoginScreen({ navigation }) {
  const { colors } = useTheme();
  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [loading,       setLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPass,      setShowPass]      = useState(false);
  const [emailError,    setEmailError]    = useState('');
  const [passError,     setPassError]     = useState('');

  const handleLogin = async () => {
    setEmailError(''); setPassError('');
    if (!email)    { setEmailError('Ingresá tu correo electrónico'); return; }
    if (!password) { setPassError('Ingresá tu contraseña'); return; }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      if (error.code === 'auth/invalid-email') {
        setEmailError('El formato del correo no es válido');
      } else if (error.code === 'auth/too-many-requests') {
        setEmailError('Demasiados intentos. Esperá unos minutos');
      } else {
        setEmailError('Correo o contraseña incorrectos');
      }
    }
    setLoading(false);
  };

  // "Ver eventos" — acceso anónimo sin registro (§ 8a UX_DESIGN_SYSTEM)
  const handleBrowse = async () => {
    try { await signInAnonymously(auth); }
    catch { Alert.alert('Error', 'No se pudo conectar. Verificá tu conexión.'); }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      if (error.code !== 'SIGN_IN_CANCELLED') {
        Alert.alert('Error', 'No se pudo iniciar sesión con Google. Intentá de nuevo.');
      }
    }
    setGoogleLoading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.flex, { backgroundColor: colors['bg.base'] }]}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo + título */}
        <View style={styles.logoSection}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            contentFit="contain"
          />
          <Text variant="display" align="center" style={styles.brand}>Enfiestados</Text>
          <Text variant="body" color="text.secondary" align="center">
            {t.onboarding.welcome.subtitle}
          </Text>
        </View>

        {/* Formulario */}
        <View style={styles.form}>
          <Input
            label="Correo electrónico"
            placeholder="tuCorreo@ejemplo.com"
            value={email}
            onChangeText={v => { setEmail(v); setEmailError(''); }}
            keyboardType="email-address"
            autoCapitalize="none"
            errorText={emailError}
            leadingIcon={<Ionicons name="mail-outline" size={18} color={colors['text.tertiary']} />}
          />

          <Input
            label="Contraseña"
            placeholder="Tu contraseña"
            value={password}
            onChangeText={v => { setPassword(v); setPassError(''); }}
            secureTextEntry={!showPass}
            errorText={passError}
            leadingIcon={<Ionicons name="lock-closed-outline" size={18} color={colors['text.tertiary']} />}
            trailingIcon={
              <Pressable onPress={() => setShowPass(v => !v)} accessibilityLabel={showPass ? 'Ocultar contraseña' : 'Ver contraseña'}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors['text.tertiary']} />
              </Pressable>
            }
            style={{ marginTop: space[3] }}
          />

          <Pressable
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.forgot}
            accessibilityRole="link"
          >
            <Text variant="label" color="link">¿Olvidaste tu contraseña?</Text>
          </Pressable>

          <Button
            variant="primary"
            size="lg"
            label="Iniciar sesión"
            onPress={handleLogin}
            loading={loading}
            fullWidth
            style={styles.mainBtn}
          />

          {/* Divider */}
          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors['border.subtle'] }]} />
            <Text variant="caption" color="text.tertiary" style={styles.dividerText}>o continuá con</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors['border.subtle'] }]} />
          </View>

          {/* Google */}
          <Pressable
            onPress={handleGoogle}
            disabled={googleLoading}
            style={[styles.googleBtn, { backgroundColor: colors['bg.raised'], borderColor: colors['border.strong'] }]}
            accessibilityRole="button"
            accessibilityLabel="Continuar con Google"
          >
            <Ionicons name="logo-google" size={20} color="#EA4335" />
            <Text variant="label" style={styles.googleLabel}>
              {googleLoading ? 'Conectando…' : 'Continuar con Google'}
            </Text>
          </Pressable>

          {/* Registro */}
          <Pressable
            onPress={() => navigation.navigate('Register')}
            style={styles.registerLink}
            accessibilityRole="link"
          >
            <Text variant="body" color="text.secondary" align="center">
              ¿No tenés cuenta?{' '}
              <Text variant="bodyStrong" style={{ color: colors['link'] }}>Registrate</Text>
            </Text>
          </Pressable>

          {/* ── Sin muro de registro (§ 8a) ── */}
          <Pressable
            onPress={handleBrowse}
            style={styles.browseLink}
            accessibilityRole="link"
            accessibilityLabel="Ver eventos sin registrarte"
          >
            <Text variant="caption" color="text.tertiary" align="center">
              {t.onboarding.welcome.skip}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:   { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: space[5], paddingVertical: space[8] },

  logoSection: { alignItems: 'center', marginBottom: space[8] },
  logo:        { width: 88, height: 88, borderRadius: 20, marginBottom: space[4] },
  brand:       { marginBottom: space[2] },

  form:    { gap: space[2] },
  forgot:  { alignSelf: 'flex-end', marginTop: space[1], padding: space[1] },
  mainBtn: { marginTop: space[4] },

  divider:     { flexDirection: 'row', alignItems: 'center', marginVertical: space[5], gap: space[3] },
  dividerLine: { flex: 1, height: 1 },
  dividerText: {},

  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    gap: space[3],
  },
  googleLabel: {},

  registerLink: { marginTop: space[5], alignSelf: 'center' },
  browseLink:   { marginTop: space[4], alignSelf: 'center', paddingVertical: space[2] },
});

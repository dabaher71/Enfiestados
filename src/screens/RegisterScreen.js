// RegisterScreen — Crear cuenta
// LÓGICA INTACTA: Firebase Auth, Firestore profile, email verification, Google.
// PRESENTACIÓN: design system v1.1 — Input, Button, tokens.
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Text from '../components/ui/Text';

import { auth, db } from '../config/firebase';
import { signInWithGoogle } from '../services/googleAuthService';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';

function getFriendlyError(code) {
  switch (code) {
    case 'auth/email-already-in-use':   return 'Este correo ya está registrado. ¿Olvidaste tu contraseña?';
    case 'auth/invalid-email':          return 'El correo no tiene un formato válido';
    case 'auth/weak-password':          return 'La contraseña es muy débil. Usá al menos 6 caracteres';
    case 'auth/network-request-failed': return 'Sin conexión. Verificá tu red e intentá de nuevo';
    case 'auth/too-many-requests':      return 'Demasiados intentos. Esperá unos minutos';
    default:                            return 'Ocurrió un error inesperado. Intentá de nuevo';
  }
}

export default function RegisterScreen({ navigation }) {
  const { colors } = useTheme();
  const [name,            setName]            = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading,         setLoading]         = useState(false);
  const [googleLoading,   setGoogleLoading]   = useState(false);
  const [showPass,        setShowPass]        = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);

  // Errores inline por campo
  const [errors, setErrors] = useState({});
  const setError = (field, msg) => setErrors(prev => ({ ...prev, [field]: msg }));
  const clearError = (field) => setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });

  const handleRegister = async () => {
    const trimName  = name.trim();
    const trimEmail = email.trim().toLowerCase();
    const newErrors = {};

    if (!trimName)            newErrors.name = 'El nombre es obligatorio';
    else if (trimName.length < 2) newErrors.name = 'El nombre debe tener al menos 2 caracteres';
    if (!trimEmail)           newErrors.email = 'El correo es obligatorio';
    if (!password)            newErrors.password = 'La contraseña es obligatoria';
    else if (password.length < 6) newErrors.password = 'Mínimo 6 caracteres';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Las contraseñas no coinciden';

    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, trimEmail, password);
      await updateProfile(user, { displayName: trimName });
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid, name: trimName, email: trimEmail,
        avatar: '', coverImage: '', bio: '', location: '',
        interests: [], followers: [], following: [], followRequests: [],
        eventsOrganized: [], eventsAttending: [],
        perfilPublico: true, verificado: false, usuariosBloqueados: [],
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      await sendEmailVerification(user);
      Alert.alert('¡Cuenta creada!', `Hola ${trimName}, te enviamos un correo de verificación. Revisá tu bandeja antes de iniciar sesión.`);
    } catch (e) {
      setError('email', getFriendlyError(e.code));
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try { await signInWithGoogle(); }
    catch (e) { if (e.code !== 'SIGN_IN_CANCELLED') Alert.alert('Error', 'No se pudo continuar con Google.'); }
    setGoogleLoading(false);
  };

  const EyeToggle = ({ show, onToggle, label }) => (
    <Pressable onPress={onToggle} accessibilityLabel={label}>
      <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors['text.tertiary']} />
    </Pressable>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.flex, { backgroundColor: colors['bg.base'] }]}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Back */}
        <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityRole="button" accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={colors['text.primary']} />
        </Pressable>

        {/* Título */}
        <View style={styles.titleSection}>
          <Text variant="display" align="center">Crear cuenta</Text>
          <Text variant="body" color="text.secondary" align="center" style={{ marginTop: space[2] }}>
            Uníte a la comunidad de eventos
          </Text>
        </View>

        {/* Formulario */}
        <View style={styles.form}>
          <Input
            label="Nombre completo"
            placeholder="Tu nombre"
            value={name}
            onChangeText={v => { setName(v); clearError('name'); }}
            errorText={errors.name}
            leadingIcon={<Ionicons name="person-outline" size={18} color={colors['text.tertiary']} />}
          />
          <Input
            label="Correo electrónico"
            placeholder="tuCorreo@ejemplo.com"
            value={email}
            onChangeText={v => { setEmail(v); clearError('email'); }}
            keyboardType="email-address"
            autoCapitalize="none"
            errorText={errors.email}
            leadingIcon={<Ionicons name="mail-outline" size={18} color={colors['text.tertiary']} />}
            style={{ marginTop: space[3] }}
          />
          <Input
            label="Contraseña"
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChangeText={v => { setPassword(v); clearError('password'); }}
            secureTextEntry={!showPass}
            errorText={errors.password}
            leadingIcon={<Ionicons name="lock-closed-outline" size={18} color={colors['text.tertiary']} />}
            trailingIcon={<EyeToggle show={showPass} onToggle={() => setShowPass(v => !v)} label="Ver contraseña" />}
            style={{ marginTop: space[3] }}
          />
          <Input
            label="Confirmar contraseña"
            placeholder="Repetí la contraseña"
            value={confirmPassword}
            onChangeText={v => { setConfirmPassword(v); clearError('confirmPassword'); }}
            secureTextEntry={!showConfirm}
            errorText={errors.confirmPassword}
            leadingIcon={<Ionicons name="shield-checkmark-outline" size={18} color={colors['text.tertiary']} />}
            trailingIcon={<EyeToggle show={showConfirm} onToggle={() => setShowConfirm(v => !v)} label="Ver confirmación" />}
            style={{ marginTop: space[3] }}
          />

          <Button variant="primary" size="lg" label="Crear cuenta" onPress={handleRegister} loading={loading} fullWidth style={{ marginTop: space[5] }} />

          {/* Divider */}
          <View style={styles.divider}>
            <View style={[styles.line, { backgroundColor: colors['border.subtle'] }]} />
            <Text variant="caption" color="text.tertiary">o continuá con</Text>
            <View style={[styles.line, { backgroundColor: colors['border.subtle'] }]} />
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
            <Text variant="label">{googleLoading ? 'Conectando…' : 'Continuar con Google'}</Text>
          </Pressable>

          <Pressable onPress={() => navigation.navigate('Login')} style={styles.loginLink} accessibilityRole="link">
            <Text variant="body" color="text.secondary" align="center">
              ¿Ya tenés cuenta?{' '}
              <Text variant="bodyStrong" style={{ color: colors['link'] }}>Iniciá sesión</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:   { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: space[5], paddingTop: space[4], paddingBottom: space[8] },
  back:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: space[3] },
  titleSection: { marginBottom: space[6] },
  form:   { gap: space[1] },
  divider:   { flexDirection: 'row', alignItems: 'center', marginVertical: space[5], gap: space[3] },
  line:      { flex: 1, height: 1 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: radius.md, borderWidth: 1.5, gap: space[3] },
  loginLink: { marginTop: space[5], alignSelf: 'center' },
});

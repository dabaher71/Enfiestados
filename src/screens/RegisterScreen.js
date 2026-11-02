// RegisterScreen — Crear cuenta
// LÓGICA INTACTA: Firebase Auth, Firestore profile, email verification, Google.
// PRESENTACIÓN: design system v1.1 — Input, Button, tokens.
import { Ionicons } from '@expo/vector-icons';
import {
  createUserWithEmailAndPassword, EmailAuthProvider, linkWithCredential,
  sendEmailVerification, signInWithEmailAndPassword, updateProfile,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Text from '../components/ui/Text';
import LanguagePicker from '../components/LanguagePicker';

import { auth, db } from '../config/firebase';
import { signInWithGoogle } from '../services/googleAuthService';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

function getFriendlyError(code) {
  switch (code) {
    case 'auth/email-already-in-use':   return i18n.t('auth.errEmailInUse');
    case 'auth/invalid-email':          return i18n.t('auth.errInvalidEmail');
    case 'auth/weak-password':          return i18n.t('auth.errWeakPassword');
    case 'auth/network-request-failed': return i18n.t('auth.errNetwork');
    case 'auth/too-many-requests':      return i18n.t('auth.tooManyAttempts');
    // Ya existe una cuenta con ese correo y la contraseña que escribió no es
    // la de esa cuenta (pasa después de intentar el link → sign-in de abajo).
    case 'auth/wrong-password':
    case 'auth/invalid-credential':     return i18n.t('auth.errWrongPassword');
    default:                            return i18n.t('auth.errUnexpected');
  }
}

// Perfil que espera el resto de la app (Profile, EditProfile, etc.) — el
// mismo shape tanto si el uid es nuevo como si viene de un link de invitado.
// Sin `email`: users/{uid} es legible por cualquier usuario autenticado, y el
// correo ya vive en Firebase Auth. Los bloqueos tampoco van acá (ver blocks).
function newProfileDoc(user, trimName) {
  return {
    uid: user.uid, name: trimName,
    avatar: user.photoURL ?? '', coverImage: '', bio: '', location: '',
    interests: [], followers: [], following: [], followRequests: [],
    eventsOrganized: [], eventsAttending: [],
    perfilPublico: true, verificado: false,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
}

export default function RegisterScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
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

    if (!trimName)            newErrors.name = t('auth.nameRequired');
    else if (trimName.length < 2) newErrors.name = t('auth.nameMin');
    if (!trimEmail)           newErrors.email = t('auth.emailRequired');
    if (!password)            newErrors.password = t('auth.passwordRequired');
    else if (password.length < 6) newErrors.password = t('auth.passwordMin');
    if (password !== confirmPassword) newErrors.confirmPassword = t('auth.passwordsMismatch');

    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    setLoading(true);
    try {
      // Invitado (§ 8a) creando cuenta real: linkWithCredential conserva el
      // uid anónimo — así los eventos que ya guardó/confirmó como invitado
      // (savedBy/attendees quedaron escritos con ESE uid) no se pierden.
      // createUserWithEmailAndPassword crearía un uid nuevo y los huerfanaría.
      const anonUser = auth.currentUser?.isAnonymous ? auth.currentUser : null;
      let user;
      let mergedIntoExisting = false;

      if (anonUser) {
        try {
          const cred = EmailAuthProvider.credential(trimEmail, password);
          user = (await linkWithCredential(anonUser, cred)).user;
        } catch (e) {
          if (e.code === 'auth/credential-already-in-use' || e.code === 'auth/email-already-in-use') {
            // Ya hay una cuenta real con ese correo — entramos con esa. Los
            // datos de la sesión de invitado se descartan, pero avisando.
            user = (await signInWithEmailAndPassword(auth, trimEmail, password)).user;
            mergedIntoExisting = true;
          } else {
            throw e;
          }
        }
      } else {
        user = (await createUserWithEmailAndPassword(auth, trimEmail, password)).user;
      }

      if (mergedIntoExisting) {
        Alert.alert(t('auth.alreadyHaveAccount'), t('auth.emailMerged', { email: trimEmail }));
      } else {
        await updateProfile(user, { displayName: trimName });
        await setDoc(doc(db, 'users', user.uid), newProfileDoc(user, trimName));
        await sendEmailVerification(user);
        Alert.alert(t('auth.accountCreated'), t('auth.accountCreatedMsg', { name: trimName }));
      }
    } catch (e) {
      setError('email', getFriendlyError(e.code));
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const { mergedWithExisting } = await signInWithGoogle();
      if (mergedWithExisting) {
        Alert.alert(t('auth.alreadyHaveAccount'), t('auth.googleMerged'));
      }
    }
    catch (e) { if (e.code !== 'SIGN_IN_CANCELLED') Alert.alert(t('common.error'), t('auth.googleContinueError')); }
    setGoogleLoading(false);
  };

  const EyeToggle = ({ show, onToggle, label }) => (
    <Pressable onPress={onToggle} accessibilityLabel={label}>
      <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors['text.tertiary']} />
    </Pressable>
  );

  return (
    // edges solo 'top': sin esto el botón de volver chocaba con la isla
    // dinámica / notch. El bottom lo cubre el paddingBottom del scroll.
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors['bg.base'] }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Back */}
        <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Ionicons name="arrow-back" size={24} color={colors['text.primary']} />
        </Pressable>

        {/* Título */}
        <View style={styles.titleSection}>
          <Text variant="display" align="center">{t('auth.createAccount')}</Text>
          <Text variant="body" color="text.secondary" align="center" style={{ marginTop: space[2] }}>
            {t('auth.joinCommunity')}
          </Text>
        </View>

        {/* Idioma: se puede elegir antes de llenar nada. Cambia toda la app
            al instante y queda guardado (también se cambia en Configuración). */}
        <View style={styles.languageSection}>
          <Text variant="caption" color="text.tertiary" align="center">{t('auth.appLanguage')}</Text>
          <LanguagePicker style={styles.languagePicker} />
        </View>

        {/* Formulario */}
        <View style={styles.form}>
          <Input
            label={t('auth.fullName')}
            placeholder={t('auth.namePlaceholder')}
            value={name}
            onChangeText={v => { setName(v); clearError('name'); }}
            errorText={errors.name}
            leadingIcon={<Ionicons name="person-outline" size={18} color={colors['text.tertiary']} />}
          />
          <Input
            label={t('auth.email')}
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChangeText={v => { setEmail(v); clearError('email'); }}
            keyboardType="email-address"
            autoCapitalize="none"
            errorText={errors.email}
            leadingIcon={<Ionicons name="mail-outline" size={18} color={colors['text.tertiary']} />}
            style={{ marginTop: space[3] }}
          />
          <Input
            label={t('auth.password')}
            placeholder={t('auth.passwordMin')}
            value={password}
            onChangeText={v => { setPassword(v); clearError('password'); }}
            secureTextEntry={!showPass}
            errorText={errors.password}
            leadingIcon={<Ionicons name="lock-closed-outline" size={18} color={colors['text.tertiary']} />}
            trailingIcon={<EyeToggle show={showPass} onToggle={() => setShowPass(v => !v)} label={t('auth.showPassword')} />}
            style={{ marginTop: space[3] }}
          />
          <Input
            label={t('auth.confirmPassword')}
            placeholder={t('auth.confirmPlaceholder')}
            value={confirmPassword}
            onChangeText={v => { setConfirmPassword(v); clearError('confirmPassword'); }}
            secureTextEntry={!showConfirm}
            errorText={errors.confirmPassword}
            leadingIcon={<Ionicons name="shield-checkmark-outline" size={18} color={colors['text.tertiary']} />}
            trailingIcon={<EyeToggle show={showConfirm} onToggle={() => setShowConfirm(v => !v)} label={t('auth.showConfirm')} />}
            style={{ marginTop: space[3] }}
          />

          {/* Ambos en enfiestados.net, servido por Firebase Hosting como
              dominio personalizado.
              Términos = el documento de marzo 2026, que describe la app tal
              como es hoy. El abogado está preparando la versión que suma venta
              de entradas; al publicarla hay que avisar en la app, como exige
              la sección 13 del propio documento. */}
          <Text variant="caption" color="text.tertiary" align="center" style={{ marginTop: space[5] }}>
            {t('auth.acceptPrefix')}{' '}
            <Text variant="caption" style={{ color: colors['link'] }} onPress={() => Linking.openURL('https://enfiestados.net/terminos')}>
              {t('auth.termsLink')}
            </Text>{' '}
            {t('auth.acceptMiddle')}{' '}
            <Text variant="caption" style={{ color: colors['link'] }} onPress={() => Linking.openURL('https://enfiestados.net/privacidad')}>
              {t('auth.privacyLink')}
            </Text>.
          </Text>

          <Button variant="primary" size="lg" label={t('auth.createAccount')} onPress={handleRegister} loading={loading} fullWidth style={{ marginTop: space[3] }} />

          {/* Divider */}
          <View style={styles.divider}>
            <View style={[styles.line, { backgroundColor: colors['border.subtle'] }]} />
            <Text variant="caption" color="text.tertiary">{t('auth.orContinueWith')}</Text>
            <View style={[styles.line, { backgroundColor: colors['border.subtle'] }]} />
          </View>

          {/* Google */}
          <Pressable
            onPress={handleGoogle}
            disabled={googleLoading}
            style={[styles.googleBtn, { backgroundColor: colors['bg.raised'], borderColor: colors['border.strong'] }]}
            accessibilityRole="button"
            accessibilityLabel={t('auth.continueGoogle')}
          >
            <Ionicons name="logo-google" size={20} color="#EA4335" />
            <Text variant="label">{googleLoading ? t('auth.connecting') : t('auth.continueGoogle')}</Text>
          </Pressable>

          <Pressable onPress={() => navigation.navigate('Login')} style={styles.loginLink} accessibilityRole="link">
            <Text variant="body" color="text.secondary" align="center">
              {t('auth.haveAccount')}{' '}
              <Text variant="bodyStrong" style={{ color: colors['link'] }}>{t('auth.signIn')}</Text>
            </Text>
          </Pressable>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex:   { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: space[5], paddingTop: space[4], paddingBottom: space[8] },
  back:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: space[3] },
  titleSection: { marginBottom: space[5] },
  languageSection: { alignItems: 'center', marginBottom: space[6], gap: space[2] },
  languagePicker: { justifyContent: 'center' },
  form:   { gap: space[1] },
  divider:   { flexDirection: 'row', alignItems: 'center', marginVertical: space[5], gap: space[3] },
  line:      { flex: 1, height: 1 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: radius.md, borderWidth: 1.5, gap: space[3] },
  loginLink: { marginTop: space[5], alignSelf: 'center' },
});

// CreatePostScreen — compositor completo (§ 2.6, 2.7)
// Avatar, visibilidad, contador, adjuntar foto, CTA amarillo, sin borde punteado violeta.
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { INPUT_LIMITS } from '../utils/security';
import { compressForUpload } from '../lib/imageUpload';
import { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createPost, MAX_POST_MEDIA } from '../services/postService';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { notifyFollowers, NOTIFICATION_TYPES } from '../services/notificationService';

import VerifyEmailSheet from '../components/VerifyEmailSheet';
import { needsEmailVerification } from '../lib/emailVerification';
import Avatar from '../components/ui/Avatar';
import Text from '../components/ui/Text';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { useTranslation } from 'react-i18next';


const MAX_TEXT = INPUT_LIMITS?.POST_TEXT ?? 1000;

export default function CreatePostScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const VISIBILITY_OPTS = [
    { label: t('post.public'),    value: 'public' },
    { label: t('post.followers'), value: 'followers' },
  ];
  const [text,       setText]       = useState('');
  const [media,      setMedia]      = useState([]);   // hasta 3 URIs locales
  const [visibility, setVisibility] = useState('public');
  const [loading,    setLoading]    = useState(false);
  const [showVerify, setShowVerify] = useState(false);

  const user = auth.currentUser;
  const libres = MAX_POST_MEDIA - media.length;
  const canPost = (text.trim().length > 0 || media.length > 0) && !loading;

  const avisarLleno = () =>
    Alert.alert(t('post.maxReached'), t('post.maxMediaMsg', { count: MAX_POST_MEDIA }));

  const pickImage = async () => {
    if (libres <= 0) { avisarLleno(); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      // allowsMultipleSelection no convive con allowsEditing: si se piden las
      // dos, el recorte gana y el selector vuelve a ser de a una.
      allowsMultipleSelection: true,
      selectionLimit: libres,
      quality: 1, // la compresión real la hace compressForUpload
    });
    if (result.canceled) return;

    // Se comprime antes de agregar (1440px, JPEG 0.85 — ver lib/imageUpload.js).
    // Antes se descartaba toda foto de más de 5 MB tal como salía de la
    // galería, que con fotos de cámara era casi siempre.
    const listas = [];
    let fallidas = 0;
    for (const a of result.assets.slice(0, libres)) {
      try { listas.push((await compressForUpload(a)).uri); } catch { fallidas++; }
    }
    if (fallidas > 0) {
      Alert.alert(t('editProfile.addError'), fallidas === 1
        ? t('post.oneImageFailed')
        : t('post.imagesFailed', { count: fallidas }));
    }
    if (listas.length) setMedia(prev => [...prev, ...listas].slice(0, MAX_POST_MEDIA));
  };

  const takePhoto = async () => {
    if (libres <= 0) { avisarLleno(); return; }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert(t('post.permissionNeeded'), t('post.cameraAccess')); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 1 });
    if (!result.canceled) {
      try {
        const { uri } = await compressForUpload(result.assets[0]);
        setMedia(prev => [...prev, uri].slice(0, MAX_POST_MEDIA));
      } catch {
        Alert.alert(t('editProfile.addError'), t('post.photoFailed'));
      }
    }
  };

  const quitarMedia = (i) => setMedia(prev => prev.filter((_, idx) => idx !== i));

  const handlePost = async () => {
    if (!canPost) return;
    setLoading(true);
    try {
      // Las reglas solo dejan publicar con el correo verificado (isVerified).
      if (await needsEmailVerification()) {
        setLoading(false);
        setShowVerify(true);
        return;
      }
      await createPost({ text: text.trim(), media, visibility });
      navigation.goBack();
      const u = auth.currentUser;
      if (u) {
        getDoc(doc(db, 'users', u.uid)).then(snap => {
          const followers = snap.data()?.followers || [];
          notifyFollowers(followers, {
            type: NOTIFICATION_TYPES.NEW_POST,
            fromUserId: u.uid,
            fromUserName: u.displayName || u.email.split('@')[0],
            fromUserAvatar: u.photoURL || '',
            message: 'hizo una nueva publicación',
          });
        }).catch(() => {});
      }
    } catch (e) {
      if (e?.code === 'permission-denied' && await needsEmailVerification()) setShowVerify(true);
      else Alert.alert(t('common.error'), t('post.createError'));
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors['border.subtle'] }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} accessibilityLabel={t('common.close')}>
          <Ionicons name="close" size={24} color={colors['text.primary']} />
        </Pressable>
        <Text variant="title">{t('post.newPost')}</Text>
        {/* CTA — amarillo, no violeta (§ 2.2) */}
        <Pressable
          onPress={handlePost}
          disabled={!canPost}
          hitSlop={4}
          style={[
            styles.publishBtn,
            { backgroundColor: canPost ? colors['action.primary'] : colors['bg.surface'] },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('createEvent.publish')}
        >
          <Text style={{
            fontSize: 14,
            fontFamily: 'PlusJakartaSans_700Bold',
            color: canPost ? colors['text.onAction'] : colors['text.tertiary'],
          }}>
            {loading ? t('createEvent.publishing') : t('createEvent.publish')}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">

          {/* Quién publica + visibilidad */}
          <View style={styles.authorRow}>
            <Avatar uri={user?.photoURL} name={user?.displayName || 'U'} size={44} />
            <View style={styles.authorInfo}>
              <Text variant="title">{user?.displayName || t('profile.user')}</Text>
              {/* Selector de visibilidad */}
              <View style={styles.visibilityWrap}>
                <SegmentedControl
                  options={VISIBILITY_OPTS}
                  selected={visibility}
                  onSelect={setVisibility}
                />
              </View>
            </View>
          </View>

          {/* Campo de texto */}
          <TextInput
            style={[styles.textInput, { color: colors['text.primary'], fontFamily: 'PlusJakartaSans_400Regular' }]}
            placeholder={t('post.placeholder')}
            placeholderTextColor={colors['text.tertiary']}
            multiline
            value={text}
            onChangeText={setText}
            maxLength={MAX_TEXT}
            autoFocus
          />

          {/* Contador de caracteres */}
          {text.length > MAX_TEXT * 0.8 && (
            <Text
              variant="caption"
              style={{
                paddingHorizontal: space[5],
                paddingBottom: space[2],
                color: text.length >= MAX_TEXT ? colors['status.urgent'] : colors['text.tertiary'],
                textAlign: 'right',
              }}
            >
              {text.length}/{MAX_TEXT}
            </Text>
          )}

          {/* Vista previa — una sola ocupa todo el ancho; dos o tres van en
              fila, porque a tamaño completo había que scrollear para ver lo
              que uno acababa de adjuntar. */}
          {media.length > 0 && (
            <View style={styles.mediaWrap}>
              {media.map((uri, i) => (
                <View
                  key={`${uri}_${i}`}
                  style={[styles.mediaItem, media.length === 1 && styles.mediaItemSolo]}
                >
                  <Image
                    source={{ uri }}
                    style={media.length === 1 ? styles.previewSolo : styles.previewChico}
                    contentFit="cover"
                  />
                  <Pressable
                    style={styles.removeImg}
                    onPress={() => quitarMedia(i)}
                    hitSlop={8}
                    accessibilityLabel={t('post.removeFile', { index: i + 1, total: media.length })}
                  >
                    <Ionicons name="close-circle" size={26} color={colors['status.urgent']} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {media.length > 0 && (
            <Text variant="caption" color="text.tertiary" style={styles.contador}>
              {media.length} de {MAX_POST_MEDIA}
            </Text>
          )}
        </ScrollView>

        {/* Toolbar — botones de adjuntar, NOT violet (§ 2.2) */}
        <View style={[styles.toolbar, { borderTopColor: colors['border.subtle'], backgroundColor: colors['bg.base'] }]}>
          <Pressable style={styles.toolBtn} onPress={pickImage} accessibilityLabel={t('post.pickImage')}>
            <Ionicons name="image-outline" size={24} color={colors['text.secondary']} />
            <Text variant="caption" color="text.secondary">{t('post.gallery')}</Text>
          </Pressable>
          <Pressable style={styles.toolBtn} onPress={takePhoto} accessibilityLabel={t('post.takePhoto')}>
            <Ionicons name="camera-outline" size={24} color={colors['text.secondary']} />
            <Text variant="caption" color="text.secondary">{t('post.camera')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <VerifyEmailSheet
        visible={showVerify}
        reason="publish"
        onClose={() => setShowVerify(false)}
        onVerified={() => handlePost()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1 },
  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[5], paddingVertical: space[3], borderBottomWidth: StyleSheet.hairlineWidth, gap: space[3] },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  publishBtn: { height: 36, paddingHorizontal: space[4], borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  authorRow: { flexDirection: 'row', paddingHorizontal: space[5], paddingVertical: space[4], gap: space[3], alignItems: 'flex-start' },
  authorInfo: { flex: 1, gap: space[2] },
  visibilityWrap: { maxWidth: 200 },
  textInput: { fontSize: 17, lineHeight: 26, paddingHorizontal: space[5], paddingBottom: space[4], minHeight: 100, textAlignVertical: 'top' },
  mediaWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], paddingHorizontal: space[5], marginBottom: space[2] },
  mediaItem:  { flex: 1, minWidth: 96, borderRadius: radius.md, overflow: 'visible', position: 'relative' },
  mediaItemSolo: { flexBasis: '100%' },
  previewSolo:  { width: '100%', aspectRatio: 4/3, borderRadius: radius.lg },
  previewChico: { width: '100%', aspectRatio: 1,   borderRadius: radius.md },
  contador:   { paddingHorizontal: space[5], marginBottom: space[3] },
  removeImg:  { position: 'absolute', top: -8, right: -8 },
  toolbar:    { flexDirection: 'row', paddingHorizontal: space[5], paddingVertical: space[3], borderTopWidth: StyleSheet.hairlineWidth, gap: space[4] },
  toolBtn:    { flexDirection: 'row', alignItems: 'center', gap: space[2] },
});

// CreatePostScreen — compositor completo (§ 2.6, 2.7)
// Avatar, visibilidad, contador, adjuntar foto, CTA amarillo, sin borde punteado violeta.
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { validateImageSize, INPUT_LIMITS } from '../utils/security';
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

import Avatar from '../components/ui/Avatar';
import Text from '../components/ui/Text';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';

const VISIBILITY_OPTS = [
  { label: 'Público',    value: 'public' },
  { label: 'Seguidores', value: 'followers' },
];

const MAX_TEXT = INPUT_LIMITS?.POST_TEXT ?? 1000;

export default function CreatePostScreen({ navigation }) {
  const { colors } = useTheme();
  const [text,       setText]       = useState('');
  const [media,      setMedia]      = useState([]);   // hasta 3 URIs locales
  const [visibility, setVisibility] = useState('public');
  const [loading,    setLoading]    = useState(false);

  const user = auth.currentUser;
  const libres = MAX_POST_MEDIA - media.length;
  const canPost = (text.trim().length > 0 || media.length > 0) && !loading;

  const avisarLleno = () =>
    Alert.alert('Máximo alcanzado', `Podés adjuntar hasta ${MAX_POST_MEDIA} archivos por publicación.`);

  const pickImage = async () => {
    if (libres <= 0) { avisarLleno(); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      // allowsMultipleSelection no convive con allowsEditing: si se piden las
      // dos, el recorte gana y el selector vuelve a ser de a una.
      allowsMultipleSelection: true,
      selectionLimit: libres,
      quality: 0.8,
    });
    if (result.canceled) return;

    const validas = [];
    let pesadas = 0;
    for (const a of result.assets.slice(0, libres)) {
      if (validateImageSize(a)) validas.push(a.uri); else pesadas++;
    }
    if (pesadas > 0) {
      Alert.alert(
        'Archivos muy grandes',
        pesadas === 1 ? 'Una imagen supera los 5 MB y no se agregó.'
                      : `${pesadas} imágenes superan los 5 MB y no se agregaron.`
      );
    }
    if (validas.length) setMedia(prev => [...prev, ...validas].slice(0, MAX_POST_MEDIA));
  };

  const takePhoto = async () => {
    if (libres <= 0) { avisarLleno(); return; }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso necesario', 'Necesitamos acceso a la cámara'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
    if (!result.canceled) {
      if (!validateImageSize(result.assets[0])) { Alert.alert('Imagen demasiado grande', 'La imagen debe ser menor a 5MB'); return; }
      setMedia(prev => [...prev, result.assets[0].uri].slice(0, MAX_POST_MEDIA));
    }
  };

  const quitarMedia = (i) => setMedia(prev => prev.filter((_, idx) => idx !== i));

  const handlePost = async () => {
    if (!canPost) return;
    setLoading(true);
    try {
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
    } catch {
      Alert.alert('Error', 'No se pudo crear la publicación');
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors['border.subtle'] }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} accessibilityLabel="Cerrar">
          <Ionicons name="close" size={24} color={colors['text.primary']} />
        </Pressable>
        <Text variant="title">Nueva publicación</Text>
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
          accessibilityLabel="Publicar"
        >
          <Text style={{
            fontSize: 14,
            fontFamily: 'PlusJakartaSans_700Bold',
            color: canPost ? colors['text.onAction'] : colors['text.tertiary'],
          }}>
            {loading ? 'Publicando…' : 'Publicar'}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">

          {/* Quién publica + visibilidad */}
          <View style={styles.authorRow}>
            <Avatar uri={user?.photoURL} name={user?.displayName || 'U'} size={44} />
            <View style={styles.authorInfo}>
              <Text variant="title">{user?.displayName || 'Usuario'}</Text>
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
            placeholder="¿Qué querés compartir?"
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
                    accessibilityLabel={`Quitar archivo ${i + 1} de ${media.length}`}
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
          <Pressable style={styles.toolBtn} onPress={pickImage} accessibilityLabel="Elegir imagen">
            <Ionicons name="image-outline" size={24} color={colors['text.secondary']} />
            <Text variant="caption" color="text.secondary">Galería</Text>
          </Pressable>
          <Pressable style={styles.toolBtn} onPress={takePhoto} accessibilityLabel="Tomar foto">
            <Ionicons name="camera-outline" size={24} color={colors['text.secondary']} />
            <Text variant="caption" color="text.secondary">Cámara</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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

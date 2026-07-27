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
import { createPost } from '../services/postService';
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
  const [image,      setImage]      = useState(null);
  const [visibility, setVisibility] = useState('public');
  const [loading,    setLoading]    = useState(false);

  const user = auth.currentUser;
  const canPost = (text.trim().length > 0 || image) && !loading;

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      if (!validateImageSize(result.assets[0])) {
        Alert.alert('Imagen demasiado grande', 'La imagen debe ser menor a 5MB');
        return;
      }
      setImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso necesario', 'Necesitamos acceso a la cámara'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
    if (!result.canceled) {
      if (!validateImageSize(result.assets[0])) { Alert.alert('Imagen demasiado grande', 'La imagen debe ser menor a 5MB'); return; }
      setImage(result.assets[0].uri);
    }
  };

  const handlePost = async () => {
    if (!canPost) return;
    setLoading(true);
    try {
      await createPost({ text: text.trim(), image, visibility });
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

          {/* Vista previa de imagen */}
          {image && (
            <View style={styles.imagePreview}>
              <Image source={{ uri: image }} style={styles.previewImg} contentFit="cover" />
              <Pressable style={styles.removeImg} onPress={() => setImage(null)} accessibilityLabel="Quitar imagen">
                <Ionicons name="close-circle" size={28} color={colors['status.urgent']} />
              </Pressable>
            </View>
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
  imagePreview: { marginHorizontal: space[5], borderRadius: radius.lg, overflow: 'hidden', position: 'relative', marginBottom: space[3] },
  previewImg: { width: '100%', aspectRatio: 4/3 },
  removeImg:  { position: 'absolute', top: space[2], right: space[2] },
  toolbar:    { flexDirection: 'row', paddingHorizontal: space[5], paddingVertical: space[3], borderTopWidth: StyleSheet.hairlineWidth, gap: space[4] },
  toolBtn:    { flexDirection: 'row', alignItems: 'center', gap: space[2] },
});

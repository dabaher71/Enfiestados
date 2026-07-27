// EditProfileScreen — Editar perfil
// LÓGICA INTACTA: imagen picker, upload a Firebase Storage, updateDoc.
// PRESENTACIÓN: design system v1.1 — Input, TextArea, SwitchRow, Avatar, tokens.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import { SwitchRow } from '../components/ui/Controls';
import Input, { TextArea } from '../components/ui/Input';
import MetaRow from '../components/ui/MetaRow';
import { SkeletonList } from '../components/ui/Skeleton';
import Text from '../components/ui/Text';

import { auth, db, storage } from '../config/firebase';
import { validateImageSize } from '../utils/security';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';

export default function EditProfileScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { user: paramUser } = route.params ?? {};

  const [name,      setName]      = useState(paramUser?.name      || '');
  const [bio,       setBio]       = useState(paramUser?.bio       || '');
  const [location,  setLocation]  = useState(paramUser?.location  || '');
  const [avatar,    setAvatar]    = useState(paramUser?.avatar    || '');
  const [cover,     setCover]     = useState(paramUser?.coverImage || '');
  const [isPrivate, setIsPrivate] = useState(paramUser?.perfilPublico === false);
  const [saving,    setSaving]    = useState(false);
  const [fetching,  setFetching]  = useState(!paramUser);

  useEffect(() => {
    if (!paramUser) {
      (async () => {
        try {
          const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
          if (snap.exists()) {
            const u = snap.data();
            setName(u.name || ''); setBio(u.bio || ''); setLocation(u.location || '');
            setAvatar(u.avatar || ''); setCover(u.coverImage || '');
            setIsPrivate(u.perfilPublico === false);
          }
        } catch {}
        setFetching(false);
      })();
    }
  }, []);

  const pickImage = async (type) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'avatar' ? [1, 1] : [16, 9],
      quality: 0.8,
    });
    if (!result.canceled) {
      const maxBytes = type === 'avatar' ? 2 * 1024 * 1024 : 3 * 1024 * 1024;
      if (!validateImageSize(result.assets[0], maxBytes)) {
        Alert.alert('Imagen demasiado grande', `La imagen debe ser menor a ${type === 'avatar' ? 2 : 3}MB`);
        return;
      }
      if (type === 'avatar') setAvatar(result.assets[0].uri);
      else setCover(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri, path) => {
    const blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => resolve(xhr.response);
      xhr.onerror = () => reject(new Error('Error al leer imagen'));
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });
    const filename = `${path}/${Date.now()}_${Math.random().toString(36).slice(7)}.jpg`;
    const storageRef = ref(storage, filename);
    await uploadBytes(storageRef, blob);
    const url = await getDownloadURL(storageRef);
    blob.close();
    return url;
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Error', 'El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      let avatarURL = paramUser?.avatar    || '';
      let coverURL  = paramUser?.coverImage || '';
      if (avatar && avatar !== paramUser?.avatar)      avatarURL = await uploadImage(avatar, 'avatars');
      if (cover  && cover  !== paramUser?.coverImage)  coverURL  = await uploadImage(cover,  'covers');
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        name: name.trim(), bio: bio.trim(), location: location.trim(),
        avatar: avatarURL, coverImage: coverURL,
        perfilPublico: !isPrivate,
        updatedAt: new Date().toISOString(),
      });
      Alert.alert('¡Listo!', 'Perfil actualizado', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el perfil');
    }
    setSaving(false);
  };

  if (fetching) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
        <SkeletonList count={5} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} accessibilityLabel="Cerrar">
          <Ionicons name="close" size={24} color={colors['text.primary']} />
        </Pressable>
        <Text variant="title">Editar perfil</Text>
        <Button variant="ghost" size="sm" label="Guardar" onPress={handleSave} loading={saving} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space[16] }}>
        {/* Cover */}
        <Pressable
          style={[styles.cover, { backgroundColor: colors['bg.surface'] }]}
          onPress={() => pickImage('cover')}
          accessibilityLabel="Cambiar foto de portada"
        >
          {cover ? <Image source={{ uri: cover }} style={styles.coverImg} contentFit="cover" /> : null}
          <View style={styles.coverOverlay}>
            <Ionicons name="camera" size={26} color="#fff" />
          </View>
        </Pressable>

        {/* Avatar */}
        <View style={styles.avatarRow}>
          <Pressable
            onPress={() => pickImage('avatar')}
            style={[styles.avatarBtn, { borderColor: colors['bg.base'] }]}
            accessibilityLabel="Cambiar foto de perfil"
          >
            <Avatar uri={avatar} name={name} size={88} />
            <View style={styles.avatarOverlay}>
              <Ionicons name="camera" size={22} color="#fff" />
            </View>
          </Pressable>
        </View>

        {/* Campos */}
        <View style={styles.form}>
          <Input label="Nombre" placeholder="Tu nombre" value={name} onChangeText={setName} />
          <TextArea
            label="Biografía"
            placeholder="Contá algo sobre vos…"
            value={bio}
            onChangeText={setBio}
            maxLength={200}
            style={{ marginTop: space[4] }}
          />
          <Input
            label="Ubicación"
            placeholder="Ej: San José, Costa Rica"
            value={location}
            onChangeText={setLocation}
            leadingIcon={<Ionicons name="location-outline" size={18} color={colors['text.tertiary']} />}
            style={{ marginTop: space[4] }}
          />

          {/* Intereses */}
          <MetaRow
            icon={<Ionicons name="sparkles-outline" size={20} color={colors['action.primary']} />}
            label="Intereses"
            value="Actualizá qué tipo de eventos querés ver"
            onPress={() => navigation.navigate('Interests', { onboarding: false })}
            style={{ marginTop: space[4] }}
          />

          {/* Privacidad */}
          <View style={[styles.privacySection, { backgroundColor: colors['bg.surface'], borderColor: colors['border.subtle'] }]}>
            <Text variant="overline" color="text.tertiary" style={{ marginBottom: space[3] }}>PRIVACIDAD</Text>
            <SwitchRow
              label="Cuenta privada"
              description={isPrivate
                ? 'Solo tus seguidores aprobados pueden ver tu perfil'
                : 'Cualquier persona puede ver tu perfil y eventos'}
              value={isPrivate}
              onValueChange={setIsPrivate}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[5], paddingVertical: space[3] },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  cover:    { height: 140, position: 'relative' },
  coverImg: { width: '100%', height: '100%' },
  coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },

  avatarRow: { alignItems: 'flex-start', paddingLeft: space[5], marginTop: -44, marginBottom: space[4] },
  avatarBtn: { borderWidth: 4, borderRadius: 999, position: 'relative', overflow: 'visible' },
  avatarOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 999, alignItems: 'center', justifyContent: 'center' },

  form: { paddingHorizontal: space[5], gap: space[1] },
  privacySection: { marginTop: space[5], borderRadius: radius.lg, padding: space[4], borderWidth: StyleSheet.hairlineWidth },
});

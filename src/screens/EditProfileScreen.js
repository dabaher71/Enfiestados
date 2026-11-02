// EditProfileScreen — Editar perfil
// LÓGICA INTACTA: imagen picker, upload a Firebase Storage, updateDoc.
// PRESENTACIÓN: design system v1.1 — Input, TextArea, SwitchRow, Avatar, tokens.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { updateProfile } from 'firebase/auth';
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
import { compressForUpload } from '../lib/imageUpload';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { useTranslation } from 'react-i18next';

export default function EditProfileScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
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
    if (status !== 'granted') { Alert.alert(t('editProfile.permissionDenied'), t('editProfile.galleryAccess')); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'avatar' ? [1, 1] : [16, 9],
      quality: 1, // la compresión real la hace compressForUpload
    });
    if (!result.canceled) {
      // Comprimida queda muy por debajo de los topes de storage.rules (2 MB
      // avatar, 3 MB portada); antes se descartaba la foto original si los
      // pasaba, que con fotos de cámara era lo normal.
      try {
        const { uri } = await compressForUpload(result.assets[0]);
        if (type === 'avatar') setAvatar(uri);
        else setCover(uri);
      } catch {
        Alert.alert(t('editProfile.addError'), t('editProfile.imageProcessError'));
      }
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
    // El uid va en la ruta: storage.rules exige {carpeta}/{uid}/... para poder
    // verificar que quien sube es el dueño. Antes el archivo quedaba suelto en
    // `avatars/archivo.jpg`, que no calza con `match /avatars/{userId}/...` y
    // habría sido rechazado apenas esas reglas se desplegaran.
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('No autenticado');
    const filename = `${path}/${uid}/${Date.now()}_${Math.random().toString(36).slice(7)}.jpg`;
    const storageRef = ref(storage, filename);
    await uploadBytes(storageRef, blob);
    const url = await getDownloadURL(storageRef);
    blob.close();
    return url;
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert(t('common.error'), t('auth.nameRequired')); return; }
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
      // Mantener Auth en sincronía con Firestore: varios lugares mandan
      // `auth.currentUser.displayName` como nombre del remitente (ej.
      // CreateEventScreen, CreatePostScreen). Si solo se actualizaba
      // Firestore, esos quedaban con el nombre viejo para siempre.
      await updateProfile(auth.currentUser, {
        displayName: name.trim(),
        photoURL: avatarURL || null,
      }).catch(() => {});
      Alert.alert(t('editEvent.doneTitle'), t('editProfile.updated'), [{ text: t('common.ok'), onPress: () => navigation.goBack() }]);
    } catch {
      Alert.alert(t('common.error'), t('editProfile.updateError'));
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
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} accessibilityLabel={t('common.close')}>
          <Ionicons name="close" size={24} color={colors['text.primary']} />
        </Pressable>
        <Text variant="title">{t('profile.editProfile')}</Text>
        <Button variant="ghost" size="sm" label={t('common.save')} onPress={handleSave} loading={saving} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space[16] }}>
        {/* Cover */}
        <Pressable
          style={[styles.cover, { backgroundColor: colors['bg.surface'] }]}
          onPress={() => pickImage('cover')}
          accessibilityLabel={t('editProfile.changeCover')}
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
            accessibilityLabel={t('editProfile.changeAvatar')}
          >
            <Avatar uri={avatar} name={name} size={88} />
            <View style={styles.avatarOverlay}>
              <Ionicons name="camera" size={22} color="#fff" />
            </View>
          </Pressable>
        </View>

        {/* Campos */}
        <View style={styles.form}>
          <Input label={t('editProfile.name')} placeholder={t('auth.namePlaceholder')} value={name} onChangeText={setName} />
          <TextArea
            label={t('editProfile.bio')}
            placeholder={t('editProfile.bioPlaceholder')}
            value={bio}
            onChangeText={setBio}
            maxLength={200}
            style={{ marginTop: space[4] }}
          />
          <Input
            label={t('editProfile.location')}
            placeholder={t('editProfile.locationPlaceholder')}
            value={location}
            onChangeText={setLocation}
            leadingIcon={<Ionicons name="location-outline" size={18} color={colors['text.tertiary']} />}
            style={{ marginTop: space[4] }}
          />

          {/* Intereses */}
          <MetaRow
            icon={<Ionicons name="sparkles-outline" size={20} color={colors['action.primary']} />}
            label={t('editProfile.interests')}
            value={t('editProfile.interestsValue')}
            onPress={() => navigation.navigate('Interests', { onboarding: false })}
            style={{ marginTop: space[4] }}
          />

          {/* Privacidad */}
          <View style={[styles.privacySection, { backgroundColor: colors['bg.surface'], borderColor: colors['border.subtle'] }]}>
            <Text variant="overline" color="text.tertiary" style={{ marginBottom: space[3] }}>{t('editProfile.privacy')}</Text>
            <SwitchRow
              label={t('editProfile.privateAccount')}
              description={isPrivate
                ? t('editProfile.privateOn')
                : t('editProfile.privateOff')}
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

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { validateImageSize } from '../utils/security';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import UserAvatar from '../components/UserAvatar';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db, storage } from '../config/firebase';

export default function EditProfileScreen({ route, navigation }) {
  const { user } = route.params;
  
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [location, setLocation] = useState(user?.location || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [coverImage, setCoverImage] = useState(user?.coverImage || '');
  const [isPrivate, setIsPrivate] = useState(() => {
    return user?.perfilPublico === false;
  });
  const [loading, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    // Si no se pasó el usuario por params, cargar desde Firestore el perfil actual
    if (!user) {
      (async () => {
        try {
          setFetching(true);
          const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
          if (userDoc.exists()) {
            const u = userDoc.data();
            setName(u.name || '');
            setBio(u.bio || '');
            setLocation(u.location || '');
            setAvatar(u.avatar || '');
            setCoverImage(u.coverImage || '');
            setIsPrivate(u.perfilPublico === false);
          }
        } catch (error) {
          console.error('Error cargando usuario:', error);
        } finally {
          setFetching(false);
        }
      })();
    }
  }, [user]);
 
  const pickImage = async (type) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'avatar' ? [1, 1] : [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      const maxBytes = type === 'avatar' ? 2 * 1024 * 1024 : 3 * 1024 * 1024;
      if (!validateImageSize(result.assets[0], maxBytes)) {
        const limitMB = type === 'avatar' ? 2 : 3;
        Alert.alert('Imagen demasiado grande', `La imagen debe ser menor a ${limitMB}MB`);
        return;
      }
      if (type === 'avatar') {
        setAvatar(result.assets[0].uri);
      } else {
        setCoverImage(result.assets[0].uri);
      }
    }
  };

  const uploadImage = async (uri, path) => {
    try {
      const blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new Error('Error al leer imagen'));
        xhr.responseType = 'blob';
        xhr.open('GET', uri, true);
        xhr.send(null);
      });
      const filename = `${path}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      blob.close();
      return downloadURL;
    } catch (error) {
      console.error('Error al subir imagen:', error);
      throw error;
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }

    setSaving(true);
    try {
      let avatarURL = user?.avatar || '';
      let coverURL = user?.coverImage || '';

      if (avatar && avatar !== user?.avatar) {
        avatarURL = await uploadImage(avatar, 'avatars');
      }

      if (coverImage && coverImage !== user?.coverImage) {
        coverURL = await uploadImage(coverImage, 'covers');
      }

      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        name: name.trim(),
        bio: bio.trim(),
        location: location.trim(),
        avatar: avatarURL,
        coverImage: coverURL,
        perfilPublico: !isPrivate,
        updatedAt: new Date().toISOString(),
      });

      Alert.alert('Exito', 'Perfil actualizado correctamente', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error al guardar:', error);
      Alert.alert('Error', 'No se pudo actualizar el perfil');
    }
    setSaving(false);
  };

  if (fetching) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#6c5ce7" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Editar perfil</Text>
          <TouchableOpacity onPress={handleSave} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#6c5ce7" />
            ) : (
              <Text style={styles.saveButton}>Guardar</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.coverContainer} onPress={() => pickImage('cover')}>
          {coverImage ? (
            <Image source={{ uri: coverImage }} style={styles.coverImage} />
          ) : null}
          <View style={styles.coverOverlay}>
            <Ionicons name="camera" size={30} color="#fff" />
          </View>
        </TouchableOpacity>

        <View style={styles.avatarSection}>
          <TouchableOpacity style={styles.avatarContainer} onPress={() => pickImage('avatar')}>
            <UserAvatar uri={avatar} size={90} style={styles.avatar} />
            <View style={styles.avatarOverlay}>
              <Ionicons name="camera" size={24} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Tu nombre"
              placeholderTextColor="#888"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Biografia</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Cuentanos sobre ti..."
              placeholderTextColor="#888"
              multiline
              numberOfLines={4}
              maxLength={200}
            />
            <Text style={styles.charCount}>{bio.length}/200</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Ubicacion</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="Ej: San Jose, Costa Rica"
              placeholderTextColor="#888"
            />
          </View>

          {/* Intereses */}
          <TouchableOpacity
            style={styles.interestsBtn}
            onPress={() => navigation.navigate('Interests', { onboarding: false })}
          >
            <Ionicons name="sparkles" size={20} color="#6c5ce7" />
            <View style={{ flex: 1 }}>
              <Text style={styles.interestsBtnTitle}>Mis intereses</Text>
              <Text style={styles.interestsBtnSub}>Actualizá qué tipo de eventos querés ver</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#555" />
          </TouchableOpacity>

          <View style={styles.privacySection}>
            <Text style={styles.sectionTitle}>Privacidad</Text>
            <View style={styles.privacyOption}>
              <View style={styles.privacyInfo}>
                <View style={styles.privacyIconContainer}>
                  <Ionicons name={isPrivate ? "lock-closed" : "lock-open"} size={24} color={isPrivate ? "#6c5ce7" : "#888"} />
                </View>
                <View style={styles.privacyText}>
                  <Text style={styles.privacyTitle}>Cuenta privada</Text>
                  <Text style={styles.privacyDescription}>
                    {isPrivate 
                      ? "Solo tus seguidores aprobados pueden ver tus eventos y actividad" 
                      : "Cualquier persona puede ver tu perfil y eventos"}
                  </Text>
                </View>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ false: '#3d3d5c', true: '#6c5ce7' }}
                thumbColor={isPrivate ? '#fff' : '#888'}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  interestsBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2d2d44', borderRadius: 14, padding: 16, marginHorizontal: 20, marginBottom: 16, gap: 14 },
  interestsBtnTitle: { color: '#fff', fontWeight: '600', fontSize: 14 },
  interestsBtnSub: { color: '#888', fontSize: 12, marginTop: 2 },
  container: {flex: 1, backgroundColor: '#1a1a2e'},
  header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15},
  headerTitle: {fontSize: 18, fontWeight: '600', color: '#fff'},
  saveButton: {color: '#6c5ce7', fontSize: 16, fontWeight: '600'},
  coverContainer: {height: 150, backgroundColor: '#2d2d44', position: 'relative'},
  coverImage: {width: '100%', height: '100%'},
  coverOverlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center'},
  avatarSection: {alignItems: 'center', marginTop: -50},
  avatarContainer: {position: 'relative'},
  avatar: {width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#1a1a2e'},
  avatarOverlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 50, justifyContent: 'center', alignItems: 'center'},
  form: {padding: 20},
  inputGroup: {marginBottom: 20},
  label: {color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8},
  input: {backgroundColor: '#2d2d44', borderRadius: 12, padding: 15, fontSize: 16, color: '#fff'},
  textArea: {height: 100, textAlignVertical: 'top'},
  charCount: {color: '#888', fontSize: 12, textAlign: 'right', marginTop: 5},
  privacySection: {marginTop: 10, backgroundColor: '#2d2d44', borderRadius: 12, padding: 15},
  sectionTitle: {color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 15},
  privacyOption: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  privacyInfo: {flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 15},
  privacyIconContainer: {width: 45, height: 45, backgroundColor: '#1a1a2e', borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginRight: 12},
  privacyText: {flex: 1},
  privacyTitle: {color: '#fff', fontSize: 16, fontWeight: '500'},
  privacyDescription: {color: '#888', fontSize: 13, marginTop: 3},
});

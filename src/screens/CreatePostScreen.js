import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { createPost } from '../services/postService';

export default function CreatePostScreen({ navigation }) {
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a la cámara');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handlePost = async () => {
    if (!text.trim() && !image) {
      Alert.alert('Error', 'Escribe algo o agrega una imagen');
      return;
    }
    setLoading(true);
    try {
      await createPost({ text: text.trim(), image });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'No se pudo crear la publicación');
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nueva publicación</Text>
        <TouchableOpacity style={[styles.postBtn, (!text.trim() && !image) && styles.postBtnDisabled]} onPress={handlePost} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.postBtnText}>Publicar</Text>
          )}
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        placeholder="¿Qué estás pensando?"
        placeholderTextColor="#666"
        multiline
        value={text}
        onChangeText={setText}
        autoFocus
      />

      {image && (
        <View style={styles.imagePreview}>
          <Image source={{ uri: image }} style={styles.previewImg} />
          <TouchableOpacity style={styles.removeImg} onPress={() => setImage(null)}>
            <Ionicons name="close-circle" size={28} color="#ff4444" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolBtn} onPress={pickImage}>
          <Ionicons name="image-outline" size={26} color="#6c5ce7" />
          <Text style={styles.toolText}>Galería</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={takePhoto}>
          <Ionicons name="camera-outline" size={26} color="#6c5ce7" />
          <Text style={styles.toolText}>Cámara</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: Platform.OS === 'android' ? 35 : 10, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#2d2d44' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  postBtn: { backgroundColor: '#6c5ce7', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  postBtnDisabled: { opacity: 0.5 },
  postBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  input: { color: '#fff', fontSize: 17, padding: 20, minHeight: 120, textAlignVertical: 'top', lineHeight: 24 },
  imagePreview: { marginHorizontal: 15, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  previewImg: { width: '100%', height: 250, borderRadius: 12 },
  removeImg: { position: 'absolute', top: 10, right: 10 },
  toolbar: { flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#2d2d44', marginTop: 'auto' },
  toolBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 25 },
  toolText: { color: '#6c5ce7', marginLeft: 8, fontSize: 14 },
});

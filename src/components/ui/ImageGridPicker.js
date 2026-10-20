// ImageGridPicker — FIX_ROUND_5 § 5. Selector de varias imágenes para crear/
// editar evento. Un componente, dos consumidores (CreateEventScreen,
// EditEventScreen) — comprime, sube con progreso y reintento por imagen, y
// deja reordenar arrastrando (la primera queda como portada, sin diálogo).
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { auth, storage } from '../../config/firebase';
import { compressForUpload } from '../../lib/imageUpload';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import Text from './Text';

const MAX_IMAGES = 10;
const THUMB = 80;

let seq = 0;
const genId = () => `img_${Date.now()}_${seq++}`;

function uploadToStorage(uri, id, onProgress) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const blob = await new Promise((res, rej) => {
          const xhr = new XMLHttpRequest();
          xhr.onload = () => res(xhr.response);
          xhr.onerror = () => rej(new Error('No se pudo leer la imagen'));
          xhr.responseType = 'blob';
          xhr.open('GET', uri, true);
          xhr.send(null);
        });
        const filename = `events/${auth.currentUser?.uid}/${Date.now()}_${id}.jpg`;
        const task = uploadBytesResumable(ref(storage, filename), blob, { contentType: 'image/jpeg' });
        task.on('state_changed',
          snap => onProgress(snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0),
          err => reject(err),
          async () => {
            try {
              const url = await getDownloadURL(task.snapshot.ref);
              blob.close?.();
              resolve(url);
            } catch (e) { reject(e); }
          }
        );
      } catch (e) { reject(e); }
    })();
  });
}

export default function ImageGridPicker({ initialUrls = [], onUploadedChange, onBusyChange }) {
  const { colors } = useTheme();
  const [items, setItems] = useState(() =>
    initialUrls.map(url => ({ id: genId(), uri: url, url, status: 'done' }))
  );
  const onUploadedChangeRef = useRef(onUploadedChange);
  onUploadedChangeRef.current = onUploadedChange;
  const onBusyChangeRef = useRef(onBusyChange);
  onBusyChangeRef.current = onBusyChange;

  useEffect(() => {
    onUploadedChangeRef.current?.(items.filter(i => i.status === 'done').map(i => i.url));
    onBusyChangeRef.current?.(items.some(i => i.status === 'uploading'));
  }, [items]);

  const updateItem = (id, patch) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)));
  };

  // Comprime (1440px, JPEG 0.85 — ver lib/imageUpload.js) y sube. Se guarda
  // la URI YA comprimida en localUri: antes se guardaba la original, y
  // "Reintentar" subía la foto sin comprimir, que storage.rules rechaza si
  // pasa de 5 MB — o sea, el reintento fallaba siempre con fotos de cámara.
  const runUpload = async (id, localUri, assetForCompress) => {
    updateItem(id, { status: 'uploading', progress: 0 });
    try {
      const uploadUri = assetForCompress ? (await compressForUpload(assetForCompress)).uri : localUri;
      updateItem(id, { localUri: uploadUri });
      const url = await uploadToStorage(uploadUri, id, (progress) => updateItem(id, { progress }));
      updateItem(id, { status: 'done', url });
    } catch {
      updateItem(id, { status: 'error' });
    }
  };

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería'); return; }
    const remaining = MAX_IMAGES - items.length;
    if (remaining <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 1, // la compresión real la hace compressForUpload después
    });
    if (result.canceled) return;

    // Sin filtro de tamaño acá: el peso que importa es el de después de
    // comprimir, no el del archivo original (que en fotos de cámara casi
    // siempre pasa de 5 MB).
    result.assets.forEach(asset => {
      const id = genId();
      setItems(prev => [...prev, { id, uri: asset.uri, asset, status: 'uploading', progress: 0 }]);
      runUpload(id, asset.uri, asset);
    });
  };

  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id));
  // Si ya se comprimió, se reintenta solo la subida; si falló la compresión
  // misma, se vuelve a comprimir desde el asset original.
  const retryItem  = (item) => (item.localUri
    ? runUpload(item.id, item.localUri, null)
    : runUpload(item.id, item.uri, item.asset ?? { uri: item.uri }));

  const renderItem = ({ item, drag, isActive, getIndex }) => {
    const isCover = getIndex() === 0;
    return (
      <ScaleDecorator>
        <Pressable
          onLongPress={drag}
          disabled={isActive}
          style={[styles.thumb, { backgroundColor: colors['bg.surface'], opacity: isActive ? 0.85 : 1 }]}
          accessibilityLabel={isCover ? 'Portada, mantené presionado para reordenar' : 'Mantené presionado para reordenar'}
        >
          <Image source={{ uri: item.uri }} style={styles.thumbImg} contentFit="cover" />

          {item.status === 'uploading' && (
            <View style={[StyleSheet.absoluteFill, styles.uploadingOverlay]}>
              <ActivityIndicator color="#fff" />
            </View>
          )}

          {item.status === 'error' && (
            <Pressable onPress={() => retryItem(item)} style={[StyleSheet.absoluteFill, styles.errorOverlay]}>
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.errorLabel}>Reintentar</Text>
            </Pressable>
          )}

          {isCover && item.status === 'done' && (
            <View style={[styles.coverBadge, { backgroundColor: colors['action.primary'] }]}>
              <Text style={[styles.coverBadgeText, { color: colors['text.onAction'] }]}>PORTADA</Text>
            </View>
          )}

          <Pressable
            onPress={() => removeItem(item.id)}
            style={styles.removeBtn}
            accessibilityLabel="Quitar imagen"
            hitSlop={4}
          >
            <Ionicons name="close" size={14} color="#fff" />
          </Pressable>
        </Pressable>
      </ScaleDecorator>
    );
  };

  return (
    <View>
      <DraggableFlatList
        horizontal
        data={items}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        onDragEnd={({ data }) => setItems(data)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space[2] }}
        ListFooterComponent={
          items.length < MAX_IMAGES ? (
            <Pressable
              onPress={pickImages}
              style={[styles.addCell, { borderColor: colors['border.strong'] }]}
              accessibilityRole="button"
              accessibilityLabel="Agregar imagen"
            >
              <Ionicons name="add" size={22} color={colors['text.tertiary']} />
            </Pressable>
          ) : null
        }
      />
      <Text variant="caption" color="text.secondary" style={{ marginTop: space[2] }}>
        Fotos o afiches · la primera es la portada
      </Text>
      <Text variant="caption" color="text.tertiary" style={{ marginTop: 2 }}>
        Cuadradas o verticales se ven mejor
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  addCell: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingOverlay: {
    backgroundColor: 'rgba(11,9,16,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorOverlay: {
    backgroundColor: 'rgba(225,72,63,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  errorLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#fff',
  },
  coverBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    borderRadius: radius.sm,
    paddingVertical: 2,
    alignItems: 'center',
  },
  // 11px — mismo piso que el token badgeNum (FIX_ROUND_4 § 6b), no 9.
  coverBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.2,
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(23,19,32,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

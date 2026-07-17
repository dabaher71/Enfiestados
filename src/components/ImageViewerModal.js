import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Modal, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function ImageViewerModal({ uri, visible, onClose }) {
  if (!uri) return null;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.imageArea} onPress={onClose} activeOpacity={1}>
          <Image
            source={{ uri }}
            style={styles.image}
            contentFit="contain"
            transition={200}
          />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  imageArea: {
    flex: 1,
  },
  image: {
    flex: 1,
    width: '100%',
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

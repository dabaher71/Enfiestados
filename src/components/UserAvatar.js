import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

export default function UserAvatar({ uri, size = 40, style }) {
  const radius = size / 2;
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[{ width: size, height: size, borderRadius: radius }, style]}
        contentFit="cover"
        transition={150}
      />
    );
  }
  return (
    <View style={[styles.placeholder, { width: size, height: size, borderRadius: radius }, style]}>
      <Ionicons name="person" size={size * 0.55} color="#888" />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

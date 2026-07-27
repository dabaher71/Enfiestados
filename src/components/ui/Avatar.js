import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/tokens';
import Text from './Text';

const GRADIENT_COLORS = ['#FFC94A', '#E1483F'];

// sizes: 26 | 32 | 40 | 48 | 56 | 88
export default function Avatar({ uri, name, size = 40, style }) {
  const { colors } = useTheme();
  const initials = getInitials(name);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
        contentFit="cover"
        transition={150}
      />
    );
  }

  // Fallback: iniciales sobre gradiente de marca
  const fontSize = size < 36 ? 12 : size < 56 ? 16 : 24;
  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      <Text style={{ fontSize, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors['text.onAction'] }}>
        {initials}
      </Text>
    </View>
  );
}

// AvatarStack — solapados, máximo 3 + contador "+N"
export function AvatarStack({ uris = [], names = [], size = 32, max = 3 }) {
  const { colors } = useTheme();
  const shown = uris.slice(0, max);
  const extra = uris.length - max;

  return (
    <View style={styles.stack}>
      {shown.map((uri, i) => (
        <View
          key={i}
          style={[
            styles.stackItem,
            {
              marginLeft: i === 0 ? 0 : -12,
              zIndex: shown.length - i,
              borderWidth: 2.5,
              borderColor: colors['bg.base'],
              borderRadius: size / 2,
            },
          ]}
        >
          <Avatar uri={uri} name={names[i]} size={size} />
        </View>
      ))}
      {extra > 0 && (
        <View
          style={[
            styles.extraBadge,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: colors['bg.raised'],
              borderWidth: 2.5,
              borderColor: colors['bg.base'],
              marginLeft: -12,
            },
          ]}
        >
          <Text variant="caption" color="text.secondary">+{extra}</Text>
        </View>
      )}
    </View>
  );
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const styles = StyleSheet.create({
  fallback: {
    // Gradiente de marca — en RN sin LinearGradient usamos el color medio
    backgroundColor: '#E1483F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackItem: {
    overflow: 'hidden',
  },
  extraBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

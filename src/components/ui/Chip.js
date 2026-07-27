import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import Text from './Text';

// Chip — tocable, para filtros. NO confundir con StatusBadge (informativo, no tocable).
export default function Chip({ label, selected = false, onPress, leadingIcon, style }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors['action.primary'] : colors['bg.surface'],
          borderColor: selected ? colors['action.primary'] : colors['border.strong'],
        },
        style,
      ]}
    >
      {leadingIcon && <leadingIcon />}
      <Text
        variant="label"
        style={{ color: selected ? colors['text.onAction'] : colors['text.secondary'] }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,          // fijo — nunca depende del padre (§ 2 FIX_ROUND_2)
    alignSelf: 'center', // blindaje contra padres con alignItems: stretch
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    borderWidth: 1.5,
    gap: space[1],
    flexShrink: 0,
    flexGrow: 0,
  },
});

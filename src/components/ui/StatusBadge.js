import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import Text from './Text';

// StatusBadge — NO tocable, informativo.
// variant: 'free' | 'urgent' | 'neutral' | 'promo'
export default function StatusBadge({ label, variant = 'neutral' }) {
  const { colors } = useTheme();
  const s = badgeStyles(variant, colors);
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text variant="overline" style={[styles.text, { color: s.text }]}>
        {label}
      </Text>
    </View>
  );
}

function badgeStyles(variant, colors) {
  switch (variant) {
    case 'free':    return { bg: colors['status.free.bg'],   text: colors['status.free'] };
    case 'urgent':  return { bg: colors['status.urgent.bg'], text: colors['status.urgent'] };
    case 'promo':   return { bg: colors['bg.surface'],        text: colors['nav.selected'] };
    default:        return { bg: colors['bg.surface'],        text: colors['text.secondary'] };
  }
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radius.sm,
  },
  text: { includeFontPadding: false },
});

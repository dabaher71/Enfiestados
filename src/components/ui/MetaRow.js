// MetaRow — cápsula de icono + label + valor + acción opcional
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import Text from './Text';

export default function MetaRow({ icon, label, value, onPress }) {
  const { colors } = useTheme();
  const Inner = (
    <View style={[styles.row, { borderBottomColor: colors['border.subtle'] }]}>
      <View style={[styles.iconCapsule, { backgroundColor: colors['bg.surface'] }]}>
        {icon}
      </View>
      <View style={styles.textBlock}>
        <Text variant="caption" color="text.tertiary">{label}</Text>
        <Text variant="subtitle" numberOfLines={2}>{value}</Text>
      </View>
      {onPress && (
        <Text variant="label" color="nav.selected">›</Text>
      )}
    </View>
  );

  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button">{Inner}</Pressable>
  ) : Inner;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: space[3],
  },
  iconCapsule: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: { flex: 1, gap: 2 },
});

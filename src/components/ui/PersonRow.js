// PersonRow — avatar + nombre + contexto + acción
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';
import Avatar from './Avatar';
import Text from './Text';

export default function PersonRow({ name, subtitle, avatarUri, onPress, trailing }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={[styles.row, { borderBottomColor: colors['border.subtle'] }]}
    >
      <Avatar uri={avatarUri} name={name} size={48} />
      <View style={styles.text}>
        <Text variant="title" numberOfLines={1}>{name}</Text>
        {subtitle && <Text variant="caption" color="text.secondary" numberOfLines={1}>{subtitle}</Text>}
      </View>
      {trailing && <View style={styles.trailing}>{trailing}</View>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[3],
    paddingHorizontal: space[5],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: space[3],
  },
  text: { flex: 1, gap: 2 },
  trailing: { alignItems: 'flex-end' },
});

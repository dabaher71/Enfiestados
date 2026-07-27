// ActionBar — barra inferior fija: 1 primaria + hasta 2 iconos, con safe area.
// Solo una por pantalla. Desaparece en flujos modales.
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { elev, space } from '../../theme/tokens';
import Button from './Button';
import Text from './Text';

export default function ActionBar({ primaryLabel, onPrimary, primaryLoading, actions = [] }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors['bg.base'],
          borderTopColor: colors['border.subtle'],
          paddingBottom: Math.max(space[4], insets.bottom),
        },
        elev[3],
      ]}
    >
      <Button
        variant="primary"
        size="lg"
        label={primaryLabel}
        onPress={onPrimary}
        loading={primaryLoading}
        fullWidth
        style={styles.primary}
      />
      {actions.slice(0, 2).map((action, i) => (
        <Pressable
          key={i}
          onPress={action.onPress}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel={action.label}
        >
          {action.icon}
          {action.label && (
            <Text variant="caption" color="text.tertiary" style={{ marginTop: 2 }}>
              {action.label}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: space[3],
    paddingHorizontal: space[5],
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space[3],
  },
  primary: { flex: 1 },
  iconBtn: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

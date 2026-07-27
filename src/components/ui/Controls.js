// Switch, Checkbox, Radio — cada uno en fila tocable completa
import { Pressable, StyleSheet, Switch as RNSwitch, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import Text from './Text';

// ─── SwitchRow ────────────────────────────────────────────────────────────────

export function SwitchRow({ label, description, value, onValueChange, disabled = false }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : () => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      style={[styles.row, { borderBottomColor: colors['border.subtle'] }]}
    >
      <View style={styles.rowText}>
        <Text variant="subtitle" color={disabled ? 'text.tertiary' : 'text.primary'}>{label}</Text>
        {description && (
          <Text variant="caption" color="text.tertiary">{description}</Text>
        )}
      </View>
      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors['border.strong'], true: colors['status.free'] }}
        thumbColor={colors['text.primary']}
        ios_backgroundColor={colors['border.strong']}
      />
    </Pressable>
  );
}

// ─── CheckboxRow ──────────────────────────────────────────────────────────────

export function CheckboxRow({ label, checked = false, onPress, disabled = false }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      style={[styles.row, { borderBottomColor: colors['border.subtle'] }]}
    >
      <View
        style={[
          styles.checkbox,
          {
            backgroundColor: checked ? colors['action.primary'] : 'transparent',
            borderColor: checked ? colors['action.primary'] : colors['border.strong'],
          },
        ]}
      >
        {checked && (
          <Text variant="caption" style={{ color: colors['text.onAction'], lineHeight: 18 }}>✓</Text>
        )}
      </View>
      <Text variant="subtitle" color={disabled ? 'text.tertiary' : 'text.primary'} style={styles.rowLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── RadioRow ─────────────────────────────────────────────────────────────────

export function RadioRow({ label, selected = false, onPress, disabled = false }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      style={[styles.row, { borderBottomColor: colors['border.subtle'] }]}
    >
      <View
        style={[
          styles.radio,
          { borderColor: selected ? colors['action.primary'] : colors['border.strong'] },
        ]}
      >
        {selected && (
          <View style={[styles.radioDot, { backgroundColor: colors['action.primary'] }]} />
        )}
      </View>
      <Text variant="subtitle" color={disabled ? 'text.tertiary' : 'text.primary'} style={styles.rowLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, gap: space[1] },
  rowLabel: { flex: 1, marginLeft: space[3] },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

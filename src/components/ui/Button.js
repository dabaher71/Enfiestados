import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Animated, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import useReducedMotion from '../../hooks/useReducedMotion';
import Text from './Text';

const SIZE_H = { lg: 56, md: 52, sm: 44, icon: 48 };

export default function Button({
  variant = 'primary',
  size = 'md',
  label,
  leadingIcon,
  trailingIcon,
  onPress,
  disabled = false,
  loading = false,
  fullWidth = false,
  haptic,        // 'light' | 'success' | 'warning' | false
  style,
  accessibilityLabel,
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();

  // useRef evita recrear el valor en cada render
  const scaleAnim = new Animated.Value(1);

  const handlePressIn = () => {
    if (reduced) return;
    Animated.timing(scaleAnim, { toValue: 0.97, duration: 90, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    if (reduced) return;
    Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }).start();
  };

  const handlePress = () => {
    if (disabled || loading) return;
    // Haptics según contexto
    const h = haptic ?? (variant === 'primary' ? 'light' : false);
    if (h === 'light')   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (h === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (h === 'warning') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    onPress?.();
  };

  const variantStyle = getVariantStyle(variant, colors, disabled);
  const height = SIZE_H[size] ?? SIZE_H.md;
  const isIcon = variant === 'icon' || size === 'icon';

  return (
    <Animated.View style={[
      { transform: [{ scale: scaleAnim }] },
      fullWidth && styles.fullWidth,
      style,
    ]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: disabled || loading }}
        style={[
          styles.base,
          { height, borderRadius: size === 'lg' ? 16 : radius.md },
          isIcon && { width: height, paddingHorizontal: 0 },
          variantStyle.container,
          fullWidth && styles.fullWidth,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={variant === 'primary' ? colors['text.onAction'] : colors['text.primary']} />
        ) : (
          <View style={styles.inner}>
            {leadingIcon && <View style={styles.iconLeft}>{leadingIcon}</View>}
            {label && <Text variant="label" style={{ color: variantStyle.textColor }}>{label}</Text>}
            {trailingIcon && <View style={styles.iconRight}>{trailingIcon}</View>}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function getVariantStyle(variant, colors, disabled) {
  if (disabled) return { container: { backgroundColor: colors['action.primary.disabled'], borderWidth: 0 }, textColor: colors['text.tertiary'] };
  switch (variant) {
    case 'primary':     return { container: { backgroundColor: colors['action.primary'] }, textColor: colors['text.onAction'] };
    case 'secondary':   return { container: { backgroundColor: colors['border.subtle'], borderWidth: 1.5, borderColor: colors['border.strong'] }, textColor: colors['text.primary'] };
    case 'ghost':       return { container: { backgroundColor: 'transparent' }, textColor: colors['link'] };
    case 'destructive': return { container: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors['status.urgent'] }, textColor: colors['status.urgent'] };
    case 'icon':        return { container: { backgroundColor: colors['border.subtle'] }, textColor: colors['text.primary'] };
    default:            return { container: { backgroundColor: colors['action.primary'] }, textColor: colors['text.onAction'] };
  }
}

const styles = StyleSheet.create({
  base:     { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[4] },
  inner:    { flexDirection: 'row', alignItems: 'center' },
  iconLeft: { marginRight: space[2] },
  iconRight:{ marginLeft: space[2] },
  fullWidth:{ width: '100%' },
});

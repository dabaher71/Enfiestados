import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TextInput, View } from 'react-native';
import useReducedMotion from '../../hooks/useReducedMotion';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import Text from './Text';

export default function Input({
  label,
  placeholder,
  value,
  onChangeText,
  errorText,
  helperText,
  maxLength,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'sentences',
  leadingIcon,
  trailingIcon,
  editable = true,
  style,
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const reduced  = useReducedMotion();
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Shake + haptic cuando aparece un error
  useEffect(() => {
    if (!errorText) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    if (!reduced) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
      ]).start();
    }
  }, [errorText]);

  const borderColor = errorText
    ? colors['status.urgent']
    : focused
    ? colors['nav.selected']
    : colors['border.strong'];

  return (
    <Animated.View style={[style, { transform: [{ translateX: shakeAnim }] }]}>
      {label && (
        <Text variant="label" color="text.secondary" style={styles.label}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.container,
          {
            borderColor,
            backgroundColor: colors['bg.surface'],
            borderWidth: focused ? 2 : 1.5,
          },
        ]}
      >
        {leadingIcon && <View style={styles.iconLeft}>{leadingIcon}</View>}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors['text.tertiary']}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, { color: colors['text.primary'] }]}
        />
        {trailingIcon && <View style={styles.iconRight}>{trailingIcon}</View>}
        {maxLength && (
          <Text variant="caption" color="text.tertiary" style={styles.counter}>
            {(value?.length ?? 0)}/{maxLength}
          </Text>
        )}
      </View>
      {errorText ? (
        <Text variant="caption" color="status.urgent" style={styles.helper}>{errorText}</Text>
      ) : helperText ? (
        <Text variant="caption" color="text.tertiary" style={styles.helper}>{helperText}</Text>
      ) : null}
    </Animated.View>
  );
}

export function TextArea({ label, placeholder, value, onChangeText, maxLength, errorText, style }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={style}>
      {label && (
        <Text variant="label" color="text.secondary" style={styles.label}>{label}</Text>
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors['text.tertiary']}
        multiline
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.textarea,
          {
            color: colors['text.primary'],
            backgroundColor: colors['bg.surface'],
            borderColor: focused ? colors['nav.selected'] : colors['border.strong'],
            borderWidth: focused ? 2 : 1.5,
          },
        ]}
      />
      {maxLength && (
        <Text variant="caption" color="text.tertiary" style={{ textAlign: 'right', marginTop: space[1] }}>
          {(value?.length ?? 0)}/{maxLength}
        </Text>
      )}
      {errorText && (
        <Text variant="caption" color="status.urgent" style={styles.helper}>{errorText}</Text>
      )}
    </View>
  );
}

export function SearchField({ value, onChangeText, placeholder = 'Buscar eventos…', style }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.searchContainer,
        {
          backgroundColor: colors['bg.surface'],
          borderColor: focused ? colors['nav.selected'] : 'transparent',
          borderWidth: 1.5,
        },
        style,
      ]}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors['text.tertiary']}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.searchInput, { color: colors['text.primary'] }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label:  { marginBottom: space[1] },
  helper: { marginTop: space[1] },
  counter: { marginRight: space[2] },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
  },
  input: { flex: 1, fontSize: 17, fontFamily: 'PlusJakartaSans_400Regular' },
  iconLeft:  { marginRight: space[2] },
  iconRight: { marginLeft: space[2] },
  textarea: {
    minHeight: 80,
    maxHeight: 160,
    borderRadius: radius.md,
    padding: space[3],
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_400Regular',
    textAlignVertical: 'top',
  },
  searchContainer: {
    height: 52,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
});

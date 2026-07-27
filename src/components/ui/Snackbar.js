import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space } from '../../theme/tokens';
import Text from './Text';

// API imperativa global: showSnackbar({ message, action, actionLabel, duration })
let _show = null;
export const showSnackbar = (opts) => { if (_show) _show(opts); };

export function SnackbarProvider({ children }) {
  const [snack, setSnack] = useState(null);
  const translateY = useRef(new Animated.Value(80)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const timerRef   = useRef(null);
  const insets     = useSafeAreaInsets();

  useEffect(() => {
    _show = (opts) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setSnack(opts);
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      const duration = opts.duration ?? (opts.action ? 6000 : 4000);
      timerRef.current = setTimeout(hide, duration);
    };
    return () => { _show = null; };
  }, []);

  const hide = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 80, duration: 120, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 0,  duration: 120, useNativeDriver: true }),
    ]).start(() => setSnack(null));
  };

  const handleAction = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    snack?.action?.();
    hide();
  };

  return (
    <>
      {children}
      {snack && (
        <Animated.View
          style={[
            styles.snack,
            { bottom: 16 + insets.bottom, transform: [{ translateY }], opacity },
          ]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Text variant="label" color="text.primary" style={styles.message} numberOfLines={2}>
            {snack.message}
          </Text>
          {snack.actionLabel && (
            <Pressable onPress={handleAction} style={styles.action}>
              <Text variant="label" style={styles.actionText}>{snack.actionLabel}</Text>
            </Pressable>
          )}
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  snack: {
    position: 'absolute',
    left: space[5],
    right: space[5],
    minHeight: 56,
    backgroundColor: '#171320',
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[3],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 12,
    zIndex: 9999,
  },
  message: { flex: 1 },
  action:  {},
  actionText: { color: '#FFC94A' },
});

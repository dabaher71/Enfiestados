import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';

const SCREEN_H = Dimensions.get('window').height;
const HEIGHTS  = { peek: 0.45, half: 0.60, full: 1.0 };

// Sheet — peek | half | full
// Arrastrá el handle para cerrar. Tocar fuera cierra (excepto destructive).
export default function Sheet({
  visible,
  onClose,
  height = 'half',  // 'peek' | 'half' | 'full'
  children,
  title,
  destructive = false,
}) {
  const { colors } = useTheme();
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const ratio = typeof height === 'number' ? height : (HEIGHTS[height] ?? 0.6);
  const sheetH = SCREEN_H * ratio;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        stiffness: 220,
        damping: 26,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_H,
        duration: 280,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Overlay */}
      <Pressable
        style={[styles.overlay, { backgroundColor: colors['bg.overlay'] }]}
        onPress={destructive ? undefined : onClose}
      />

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            height: sheetH,
            backgroundColor: colors['bg.raised'],
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: colors['border.strong'] }]} />

        {/* Header opcional */}
        {(title || height === 'full') && (
          <View style={[styles.header, { borderBottomColor: colors['border.subtle'] }]}>
            {title && (
              <View style={styles.headerTitle}>
                <Animated.Text
                  style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: colors['text.primary'] }}
                >
                  {title}
                </Animated.Text>
              </View>
            )}
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Cerrar">
              <Animated.Text style={{ fontSize: 20, color: colors['text.secondary'] }}>✕</Animated.Text>
            </Pressable>
          </View>
        )}

        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: space[3],
    marginBottom: space[2],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingBottom: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { flex: 1 },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Keyboard, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
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
  // Desplazamiento extra cuando aparece el teclado. Va aparte de translateY
  // (que es el show/hide) y se suman: así una animación no pisa a la otra.
  const kbOffset = useRef(new Animated.Value(0)).current;
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

  // El sheet está anclado con bottom:0 y alto fijo, así que sin esto el
  // teclado le tapa la parte de abajo — justo donde suelen ir los botones.
  useEffect(() => {
    // En iOS willShow/willHide llegan antes de que el teclado se mueva, lo que
    // deja la animación sincronizada. Android solo emite los did*.
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    // Tope: nunca subir más que el espacio libre encima del sheet, o el
    // encabezado se saldría de la pantalla (un sheet 'full' no sube nada).
    const maxShift = Math.max(0, SCREEN_H - sheetH);

    const onShow = (e) => {
      const kbH = e?.endCoordinates?.height ?? 0;
      Animated.timing(kbOffset, {
        toValue: -Math.min(kbH, maxShift),
        duration: e?.duration || 250,
        useNativeDriver: true,
      }).start();
    };
    const onHide = (e) => {
      Animated.timing(kbOffset, {
        toValue: 0,
        duration: e?.duration || 250,
        useNativeDriver: true,
      }).start();
    };

    const showSub = Keyboard.addListener(showEvt, onShow);
    const hideSub = Keyboard.addListener(hideEvt, onHide);
    return () => { showSub.remove(); hideSub.remove(); };
  }, [sheetH]);

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
            transform: [{ translateY: Animated.add(translateY, kbOffset) }],
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

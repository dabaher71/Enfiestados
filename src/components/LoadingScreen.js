// LoadingScreen — pantalla de arranque mientras se resuelve el estado de auth.
// Se monta desde AppNavigator, ya dentro de ThemeProvider y con las fuentes
// cargadas (App.js no renderiza nada hasta que useFonts termina), así que usa
// los tokens y la tipografía del design system como el resto de la app.
import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import Text from './ui/Text';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';

const LOGO = 88;

export default function LoadingScreen() {
  const { colors } = useTheme();
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  return (
    <View style={[styles.container, { backgroundColor: colors['bg.base'] }]}>
      <Animated.View
        style={[
          styles.logoContainer,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* El logo se apila sobre el título en vez de ir al lado: a este tamaño
            en fila se comía el ancho en pantallas angostas. */}
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.logo}
        />
        <Text variant="display" align="center" style={styles.title}>Enfiestados</Text>
        <Text variant="body" color="text.secondary" align="center">
          Descubrí eventos cerca tuyo
        </Text>
      </Animated.View>

      <Animated.View style={[styles.loader, { opacity: fadeAnim }]}>
        <View style={[styles.dot, { backgroundColor: colors['nav.selected'] }]} />
        <View style={[styles.dot, styles.dotMiddle, { backgroundColor: colors['nav.selected'] }]} />
        <View style={[styles.dot, { backgroundColor: colors['nav.selected'] }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space[6],
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: space[12],
  },
  logo: {
    width: LOGO,
    height: LOGO,
    // El PNG es un cuadrado con fondo amarillo: en el ícono de la app iOS le
    // aplica el redondeo, pero acá se renderiza crudo y se veía con esquinas
    // rectas. radius.lg (20) sobre 88px queda cerca de la proporción del ícono.
    borderRadius: radius.lg,
    marginBottom: space[4],
  },
  title: {
    marginBottom: space[1],
  },
  loader: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 80,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 5,
    opacity: 0.3,
  },
  dotMiddle: {
    opacity: 0.6,
  },
});

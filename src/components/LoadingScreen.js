import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';

export default function LoadingScreen() {
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
    <View style={styles.container}>
      {/* Logo + título */}
      <Animated.View
        style={[
          styles.logoContainer,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <View style={styles.titleRow}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
          />
          <Text style={styles.title}>Enfiestados</Text>
        </View>
        <Text style={styles.subtitle}>Descubre eventos cerca de ti</Text>
      </Animated.View>

      {/* Indicador de carga */}
      <Animated.View style={[styles.loader, { opacity: fadeAnim }]}>
        <View style={styles.dot} />
        <View style={[styles.dot, styles.dotMiddle]} />
        <View style={styles.dot} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
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
    backgroundColor: '#6c5ce7',
    marginHorizontal: 5,
    opacity: 0.3,
  },
  dotMiddle: {
    opacity: 0.6,
  },
});

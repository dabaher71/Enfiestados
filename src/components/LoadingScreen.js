import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';

export default function LoadingScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

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

    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Logo + texto Enfiestados */}
        <View style={styles.titleRow}>
          <Image
            source={require('../../assets/images/logo.png')} // tu logo con sombrero
            style={styles.logo}
          />
          <Text style={styles.title}>Enfiestados</Text>
        </View>

        <Text style={styles.subtitle}>Descubre eventos cerca de ti</Text>
      </Animated.View>

      {/* Rueda girando como ícono de carga */}
      <Animated.Image
        source={require('../../assets/images/rueda.png')}
        style={[styles.wheel, { transform: [{ rotate: spin }] }]}
      />

      {/* Loader con puntitos */}
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
  wheel: {
  width: 140,
  height: 140,
  marginTop: 40,
  elevation: 10,
},
  loader: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 100,
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

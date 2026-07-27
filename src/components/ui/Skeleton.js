import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';

function Bone({ width, height, style }) {
  const { colors } = useTheme();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius.sm, backgroundColor: colors['bg.raised'], opacity },
        style,
      ]}
    />
  );
}

// Skeleton de una fila de evento: miniatura + 3 líneas
export function SkeletonEventRow() {
  return (
    <View style={styles.row}>
      <Bone width={72} height={72} style={{ borderRadius: radius.md }} />
      <View style={styles.lines}>
        <Bone width="40%" height={12} />
        <Bone width="85%" height={16} style={{ marginTop: space[2] }} />
        <Bone width="60%" height={12} style={{ marginTop: space[2] }} />
      </View>
    </View>
  );
}

// Lista de skeletons
export function SkeletonList({ count = 4 }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonEventRow key={i} />
      ))}
    </View>
  );
}

// Skeleton genérico
export default function Skeleton({ width = '100%', height = 16, style }) {
  return <Bone width={width} height={height} style={style} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    gap: space[3],
  },
  lines: {
    flex: 1,
  },
});

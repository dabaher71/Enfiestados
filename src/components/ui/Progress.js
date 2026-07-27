import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import Text from './Text';

// ─── StepProgress ─────────────────────────────────────────────────────────────

export function StepProgress({ current, total }) {
  const { colors } = useTheme();
  const pct = total > 0 ? current / total : 0;
  return (
    <View style={styles.stepRow}>
      <View style={[styles.stepTrack, { backgroundColor: colors['bg.surface'] }]}>
        <View
          style={[
            styles.stepFill,
            { backgroundColor: colors['action.primary'], width: `${pct * 100}%` },
          ]}
        />
      </View>
      <Text variant="caption" color="text.tertiary" style={styles.stepLabel}>
        Paso {current} de {total}
      </Text>
    </View>
  );
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────

export function ProgressBar({ value = 0, max = 100, style }) {
  const { colors } = useTheme();
  const pct = Math.min(1, Math.max(0, value / max));
  return (
    <View style={[styles.barTrack, { backgroundColor: colors['bg.surface'] }, style]}>
      <View
        style={[
          styles.barFill,
          { backgroundColor: colors['action.primary'], width: `${pct * 100}%` },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  stepTrack: {
    flex: 1,
    height: 6,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  stepFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  stepLabel: {},
  barTrack: {
    height: 6,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radius.full,
  },
});

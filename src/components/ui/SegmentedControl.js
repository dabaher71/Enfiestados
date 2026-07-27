import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import Text from './Text';

// SegmentedControl — 2-3 opciones, dentro de pantalla (no barra de tabs)
export function SegmentedControl({ options, selected, onSelect }) {
  const { colors, isDark } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : colors['bg.surface'] }]}>
      {options.map((opt) => {
        const isActive = opt.value === selected;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            style={[
              styles.segment,
              isActive && [
                styles.segmentActive,
                {
                  backgroundColor: isDark ? colors['text.primary'] : colors['bg.raised'],
                  shadowColor: colors['bg.overlay'],
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.12,
                  shadowRadius: 2,
                  elevation: 2,
                },
              ],
            ]}
          >
            <Text
              variant="label"
              style={{ color: isActive ? colors['text.primary'] : colors['text.tertiary'] }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// UnderlineTabs — para ≥4 secciones o contenido paginable
export function UnderlineTabs({ options, selected, onSelect }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.underlineContainer, { borderBottomColor: colors['border.subtle'] }]}>
      {options.map((opt) => {
        const isActive = opt.value === selected;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            style={styles.underlineTab}
          >
            <Text
              variant="label"
              style={{
                color: isActive ? colors['text.primary'] : colors['text.tertiary'],
                fontSize: 15,
              }}
            >
              {opt.label}
            </Text>
            {isActive && (
              <View style={[styles.underlineIndicator, { backgroundColor: colors['nav.selected'] }]} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: space[1],
    gap: space[1],
  },
  segment: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  segmentActive: {
    borderRadius: radius.sm,
  },
  underlineContainer: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  underlineTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space[3],
    position: 'relative',
  },
  underlineIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '10%',
    right: '10%',
    height: 3,
    borderRadius: 2,
  },
});

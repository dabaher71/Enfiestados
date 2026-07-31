import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import Text from './Text';

// SegmentedControl — 2-3 opciones dentro de pantalla (no barra de tabs)
// Fix § 1.1: texto activo SIEMPRE contrasta con el fill, claro y oscuro.
export function SegmentedControl({ options, selected, onSelect }) {
  const { colors, isDark } = useTheme();

  // Fill del ítem activo
  const activeBg = isDark ? colors['text.primary'] : colors['bg.raised'];
  // Texto sobre el fill: siempre el ink del tema opuesto al fill
  const activeText   = isDark ? colors['bg.base'] : colors['text.primary'];
  // Texto inactivo: text.secondary (más legible que tertiary)
  const inactiveText = colors['text.secondary'];

  return (
    <View style={[styles.container, {
      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : colors['bg.surface'],
    }]}>
      {options.map(opt => {
        const isActive = opt.value === selected;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            style={[
              styles.segment,
              isActive && {
                backgroundColor: activeBg,
                borderRadius: radius.sm,
                // Sombra para separarlo del track
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.10,
                shadowRadius: 3,
                elevation: 2,
              },
            ]}
          >
            <Text
              variant="label"
              style={{ color: isActive ? activeText : inactiveText }}
            >
              {opt.label}
            </Text>
            {opt.badge > 0 && (
              <View style={[styles.segmentBadge, { backgroundColor: colors['status.urgent'] }]}>
                <Text variant="badgeNum" style={{ color: '#fff' }}>
                  {opt.badge}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// UnderlineTabs — para ≥4 secciones o contenido paginable horizontalmente
export function UnderlineTabs({ options, selected, onSelect }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.underlineContainer, { borderBottomColor: colors['border.subtle'] }]}>
      {options.map(opt => {
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
                color: isActive ? colors['text.primary'] : colors['text.secondary'],
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
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
    borderRadius: radius.sm,
  },
  segmentBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
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

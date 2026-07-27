// EventCardHero — afiche 1:1, overlay, badges, CTA.
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useRef } from 'react';
import useReducedMotion from '../../hooks/useReducedMotion';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { formatEventDate, formatPrice } from '../../lib/format';
import StatusBadge from './StatusBadge';
import Text from './Text';

export default function EventCardHero({ event, onPress, onSave, saved = false }) {
  const { colors } = useTheme();
  const reduced  = useReducedMotion();
  const saveAnim = useRef(new Animated.Value(1)).current;

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!reduced) {
      Animated.sequence([
        Animated.timing(saveAnim, { toValue: 1.15, duration: 160, useNativeDriver: true }),
        Animated.timing(saveAnim, { toValue: 1,    duration: 160, useNativeDriver: true }),
      ]).start();
    }
    onSave?.();
  };
  const dateStr = formatEventDate(event.date, event.time);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${dateStr}`}
      style={[styles.card, { backgroundColor: colors['bg.surface'] }]}
    >
      {/* Afiche — ratio 1:1 */}
      <View style={styles.imageContainer}>
        {event.imageUrl || event.image ? (
          <Image
            source={{ uri: event.imageUrl || event.image }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.image, { backgroundColor: colors['bg.raised'] }]} />
        )}

        {/* Overlay gradiente */}
        <View style={styles.overlay} />

        {/* Badge fecha — arriba izquierda */}
        <View style={styles.badgeTopLeft}>
          <StatusBadge label={dateStr.toUpperCase()} variant="neutral" />
        </View>

        {/* Guardar — arriba derecha */}
        <Pressable
          onPress={handleSave}
          style={styles.saveBtn}
          accessibilityLabel={saved ? 'Quitar de guardados' : 'Guardar evento'}
          hitSlop={8}
        >
          <Animated.View style={{ transform: [{ scale: saveAnim }] }}>
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={saved ? colors['action.primary'] : colors['text.primary']}
            />
          </Animated.View>
        </Pressable>
      </View>

      {/* Contenido */}
      <View style={styles.content}>
        {event.category && (
          <Text variant="overline" color="text.tertiary">{event.category.toUpperCase()}</Text>
        )}
        <Text variant="h3" numberOfLines={2} style={styles.title}>{event.title}</Text>

        <View style={styles.meta}>
          {event.location?.name && (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={14} color={colors['text.tertiary']} />
              <Text variant="caption" color="text.secondary" numberOfLines={1} style={styles.metaText}>
                {event.location.name}
              </Text>
            </View>
          )}
          <StatusBadge
            label={formatPrice(event.price, event.isFree)}
            variant={event.isFree ? 'free' : 'neutral'}
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginHorizontal: space[5],
  },
  imageContainer: {
    aspectRatio: 1,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,9,16,0.35)',
  },
  badgeTopLeft: {
    position: 'absolute',
    top: space[3],
    left: space[3],
  },
  saveBtn: {
    position: 'absolute',
    top: space[2],
    right: space[3],
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: space[4],
    gap: space[2],
  },
  title: { marginVertical: space[1] },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    flex: 1,
  },
  metaText: { flex: 1 },
});

// EventRow — el componente más usado de la app.
// Cualquier pantalla que muestre un evento en lista usa ESTE componente.
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { formatEventDate, formatPrice } from '../../lib/format';
import StatusBadge from './StatusBadge';
import Text from './Text';

// trailing: 'badge' | 'price' | 'icon' | 'none'
export default function EventRow({ event, trailing = 'price', onPress, onSave, trailingIcon }) {
  const { colors } = useTheme();
  const dateStr = formatEventDate(event.date, event.time);
  const meta    = [event.category, dateStr].filter(Boolean).join(' · ').toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${dateStr}`}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors['bg.surface'] : 'transparent' },
      ]}
    >
      {/* Miniatura */}
      <View style={[styles.thumb, { backgroundColor: colors['bg.surface'] }]}>
        {event.imageUrl || event.image ? (
          <Image
            source={{ uri: event.imageUrl || event.image }}
            style={styles.thumbImg}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View style={[styles.thumbPlaceholder, { backgroundColor: colors['bg.raised'] }]} />
        )}
      </View>

      {/* Contenido */}
      <View style={styles.content}>
        <Text variant="overline" color="text.tertiary" numberOfLines={1}>{meta}</Text>
        <Text variant="title" numberOfLines={2} style={styles.title}>{event.title}</Text>
        {event.location?.name && (
          <Text variant="caption" color="text.secondary" numberOfLines={1}>
            {event.location.name}
          </Text>
        )}
      </View>

      {/* Trailing */}
      <View style={styles.trailing}>
        {trailing === 'price' && (
          <StatusBadge
            label={formatPrice(event.price, event.isFree)}
            variant={event.isFree ? 'free' : 'neutral'}
          />
        )}
        {trailing === 'badge' && event.status && (
          <StatusBadge label={event.status} variant="urgent" />
        )}
        {trailing === 'icon' && trailingIcon}
      </View>
    </Pressable>
  );
}

// SponsoredCard — idéntica a EventRow + etiqueta PATROCINADO
export function SponsoredCard({ event, onPress }) {
  const { colors } = useTheme();
  return (
    <View>
      <View style={[styles.sponsoredLabel, { backgroundColor: colors['bg.surface'] }]}>
        <Text variant="overline" color="text.tertiary">· PATROCINADO</Text>
      </View>
      <EventRow event={event} onPress={onPress} trailing="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 96,
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    gap: space[3],
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    overflow: 'hidden',
    flexShrink: 0,
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbPlaceholder: { flex: 1 },
  content: { flex: 1, gap: space[1] },
  title:   { marginVertical: 2 },
  trailing: { alignItems: 'flex-end', justifyContent: 'center', minWidth: 60 },
  sponsoredLabel: {
    paddingHorizontal: space[5],
    paddingVertical: space[1],
  },
});

// EventRow — el componente más usado de la app.
// Cualquier pantalla que muestre un evento en lista usa ESTE componente.
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { formatTimeShort } from '../../lib/format';
import StatusBadge from './StatusBadge';
import Text from './Text';

// Trailing badge: orden exacto del FIX_ROUND_1 § 2.4
// 1. soldOutSoon  → "ÚLTIMAS"  (urgent)
// 2. price === 0  → "GRATIS"   (free)
// 3. price > 0    → precio     (neutral con texto ₡)
// 4. sin dato     → nada
function TrailingBadge({ event }) {
  if (event.soldOutSoon) {
    return <StatusBadge label="ÚLTIMAS" variant="urgent" />;
  }
  if (event.isFree === true || event.price === 0) {
    return <StatusBadge label="Gratis" variant="free" />;
  }
  if (event.price > 0) {
    return <StatusBadge label={`₡${Number(event.price).toLocaleString('es-CR')}`} variant="neutral" />;
  }
  // Sin dato de precio confiable — no mostrar nada (evita "GRATIS" falso en importados)
  return null;
}

// Overline: "8:00 PM · SHOW" (hora + categoría). La fuente va abajo como subtítulo.
function buildOverline(event) {
  const time = formatTimeShort(event.time ?? event.eventTime ?? '');
  const cat  = event.category ?? '';
  return [time, cat.toUpperCase()].filter(Boolean).join(' · ');
}

// Subtítulo de ubicación. Si es importado, añade "Vía [fuente]"
function buildSubtitle(event) {
  const place  = event.location?.name ?? event.locationText ?? '';
  const source = event._isExternal && event.source ? `Vía ${event.source}` : '';
  return place || source || '';
}

// trailing: 'auto' | 'icon' | 'none'
export default function EventRow({ event, trailing = 'auto', onPress, trailingIcon }) {
  const { colors } = useTheme();
  const overline = buildOverline(event);
  const subtitle = buildSubtitle(event);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={event.title}
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
        {overline ? (
          <Text variant="overline" color="text.tertiary" numberOfLines={1}>{overline}</Text>
        ) : null}
        <Text variant="title" numberOfLines={2} style={styles.title}>{event.title}</Text>
        {subtitle ? (
          <Text variant="caption" color="text.tertiary" numberOfLines={1} ellipsizeMode="tail">
            {subtitle}
          </Text>
        ) : null}
      </View>

      {/* Trailing */}
      <View style={styles.trailing}>
        {trailing === 'auto' && <TrailingBadge event={event} />}
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
        <Text variant="overline" color="text.tertiary">PATROCINADO</Text>
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

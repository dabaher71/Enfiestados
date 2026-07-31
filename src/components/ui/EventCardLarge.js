// EventCardLarge — FIX_ROUND_5 § 1 y § 4. Card grande de Inicio (variant="large")
// y card hero de Explorar (variant="compact"). Reemplaza a EventRow SOLO en esas
// dos pantallas — EventRow sigue siendo el componente de Mis planes, Perfil y
// resultados de búsqueda por texto.
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { auth } from '../../config/firebase';
import { toggleAttendance, toggleSaved } from '../../services/eventService';
import { toggleSavedExternal } from '../../services/externalEventService';
import { formatCardDate, formatDateBadge, getImages } from '../../lib/format';
import { requireAccount } from '../../lib/requireAccount';
import { safeOpenURL } from '../../utils/security';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import Button from './Button';
import MediaCarousel from './MediaCarousel';
import StatusBadge from './StatusBadge';
import Text from './Text';

const VARIANTS = {
  large:   { aspectRatio: 1.3, btnSize: 48, priceFontSize: 17,   btnGap: space[2] },
  compact: { aspectRatio: 2.2, btnSize: 46, priceFontSize: 16.5, btnGap: space[2] },
};

// Chrome sobre foto — igual que el heroBtn/typeBadge de EventDetailScreen:
// el fondo es SIEMPRE un overlay oscuro fijo, sin importar el tema de la
// app, así que el texto también es fijo (no colors['text.primary'], que en
// claro sería oscuro sobre oscuro). action.primary sí sale de tokens porque
// vale lo mismo en los dos temas.
function DateBadge({ event }) {
  const { colors } = useTheme();
  const rawDate = event._isExternal ? event.dateISO : event.date;
  const badge = formatDateBadge(rawDate);
  if (!badge) return null;
  return (
    <BlurView intensity={35} tint="dark" style={styles.dateBadge}>
      <View style={styles.dateBadgeOverlay} />
      <Text style={[styles.dateBadgeDay, { color: colors['action.primary'] }]}>{badge.day}</Text>
      <Text style={styles.dateBadgeMonth}>{badge.month}</Text>
    </BlurView>
  );
}

export default function EventCardLarge({ event, variant = 'large', onPress, savedExternalIds }) {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const v = VARIANTS[variant] ?? VARIANTS.large;
  const userId = auth.currentUser?.uid;

  const isExternal = !!event._isExternal;
  const images = getImages(event);

  const [savedOverride, setSavedOverride]   = useState(null);
  const [attendOverride, setAttendOverride] = useState(null);

  const isSaved = savedOverride ?? (isExternal
    ? !!savedExternalIds?.has(event.id)
    : !!event.savedBy?.includes(userId));
  const isAttending = attendOverride ?? (!isExternal && !!event.attendees?.includes(userId));

  const handleSave = useCallback(async () => {
    if (!requireAccount(navigation, 'Creá una cuenta para guardar este evento en Mis planes.')) return;
    const next = !isSaved;
    setSavedOverride(next);
    try {
      if (isExternal) await toggleSavedExternal(userId, event.id);
      else await toggleSaved(event.id, userId);
    } catch {
      setSavedOverride(!next);
    }
  }, [navigation, isSaved, isExternal, userId, event.id]);

  const handlePrimary = useCallback(async () => {
    if (isExternal) {
      safeOpenURL(event.eventUrl);
      return;
    }
    if (!requireAccount(navigation, 'Creá una cuenta para confirmar tu asistencia.')) return;
    const next = !isAttending;
    setAttendOverride(next);
    try {
      await toggleAttendance(event.id, userId);
    } catch {
      setAttendOverride(!next);
    }
  }, [navigation, isExternal, event, isAttending, userId]);

  const rawDate = isExternal ? event.dateISO : event.date;
  const rawTime = isExternal ? (event.time ?? event.eventTime ?? '') : event.time;
  const dateText = rawDate ? formatCardDate(rawDate, rawTime) : (event.dateText || '');
  const locationText = event.location?.name ?? event.locationText ?? '';
  const sourceText = isExternal && event.source ? `Vía ${event.source}` : '';

  const hasConfidentPrice = !isExternal || (event.price !== undefined && event.price !== null);
  const isFree = event.isFree === true || event.price === 0;

  return (
    <View style={[styles.card, { backgroundColor: colors['bg.surface'], borderColor: colors['border.subtle'] }]}>
      <MediaCarousel
        images={images}
        aspectRatio={v.aspectRatio}
        onPress={onPress}
        labelPrefix={event.title ? `del evento ${event.title}` : ''}
        topLeftSlot={<DateBadge event={event} />}
      />

      <View style={styles.info}>
        {/* Badges: urgencia → categoría, máximo 2 */}
        {(event.soldOutSoon || event.category) && (
          <View style={styles.badgeRow}>
            {event.soldOutSoon && <StatusBadge label="ÚLTIMAS" variant="urgent" />}
            {event.category && <StatusBadge label={event.category.toUpperCase()} variant="neutral" />}
          </View>
        )}

        <Pressable onPress={onPress} accessibilityRole="button">
          <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
        </Pressable>

        {dateText ? (
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={18} color={colors['action.primary']} />
            <Text style={[styles.dateLabel, { color: colors['text.primary'] }]} numberOfLines={1}>
              {dateText}
            </Text>
          </View>
        ) : null}

        {locationText ? (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={18} color={colors['text.tertiary']} />
            <Text variant="caption" color="text.tertiary" numberOfLines={1} style={{ flex: 1 }}>
              {locationText}
            </Text>
          </View>
        ) : null}

        {/* Fila de acción — un solo botón amarillo por card */}
        <View style={styles.actionRow}>
          <View style={styles.priceCluster}>
            {isFree ? (
              <StatusBadge label="GRATIS" variant="free" />
            ) : hasConfidentPrice && event.price > 0 ? (
              <Text style={[styles.price, { fontSize: v.priceFontSize, color: colors['text.primary'] }]}>
                ₡{Number(event.price).toLocaleString('es-CR')}
              </Text>
            ) : null}
            {sourceText ? (
              <Text variant="caption" color="text.tertiary" numberOfLines={1}>{sourceText}</Text>
            ) : null}
          </View>

          <Button
            variant="icon"
            size={v.btnSize}
            leadingIcon={<Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={20} color={isSaved ? colors['status.urgent'] : colors['text.primary']} />}
            onPress={handleSave}
            accessibilityLabel={isSaved ? 'Quitar de Mis planes' : 'Guardar en Mis planes'}
            style={{ marginLeft: 'auto' }}
          />
          <Button
            variant="primary"
            size={v.btnSize}
            label={isExternal ? 'Comprar' : (isAttending ? 'Vas a ir' : 'Voy')}
            onPress={handlePrimary}
            style={{ marginLeft: v.btnGap }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    marginHorizontal: space[5],
    marginBottom: space[6],
    overflow: 'hidden',
  },
  info: {
    padding: space[4],
  },
  badgeRow: {
    flexDirection: 'row',
    gap: space[2],
    marginBottom: space[3],
  },
  title: {
    fontFamily: 'BricolageGrotesque_700Bold',
    fontSize: 21,
    lineHeight: 24,
    letterSpacing: -0.21,
    marginBottom: space[2],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginTop: 4,
  },
  dateLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15.5,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space[3],
  },
  priceCluster: {
    flex: 1,
    gap: 2,
  },
  price: {
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  dateBadge: {
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: 11,
    paddingVertical: 7,
    overflow: 'hidden',
  },
  dateBadgeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,9,16,0.7)',
  },
  dateBadgeDay: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 19,
    lineHeight: 22,
  },
  dateBadgeMonth: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10.5,
    letterSpacing: 0.84, // .08em de 10.5
    color: '#F7F4EF',
  },
});

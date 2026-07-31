// InternalAdCard — anuncio interno en el feed
// FIX_ROUND_4 § 10.1: componente activo (se renderiza en Home) que había
// quedado fuera de la migración a tokens — mismo violeta-como-botón que ya
// se corrigió en el módulo de anuncios en la ronda 3.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { recordClick, recordImpression } from '../services/adService';
import { safeOpenURL } from '../utils/security';
import Button from './ui/Button';
import Text from './ui/Text';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';

const CTA_ICONS = {
  'Ver más': 'arrow-forward',
  'Asistir': 'calendar',
  'Comprar': 'cart',
  'Visitar': 'globe',
};

function InternalAdCard({ ad, onEventPress }) {
  const { colors } = useTheme();

  useEffect(() => {
    if (ad.id !== 'preview') recordImpression(ad.id);
  }, [ad.id]);

  const handleCTA = async () => {
    await recordClick(ad.id);
    if (ad.type === 'event' && ad.eventId && onEventPress) {
      onEventPress(ad.eventId);
    } else if (ad.targetUrl) {
      safeOpenURL(ad.targetUrl);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors['bg.surface'] }]}>
      {ad.image ? (
        <Image
          source={{ uri: ad.image }}
          style={[styles.image, { backgroundColor: colors['bg.raised'] }]}
          contentFit="cover"
          transition={200}
        />
      ) : null}

      <View style={styles.body}>
        <View style={styles.sponsoredRow}>
          <Ionicons name="megaphone" size={13} color={colors['nav.selected']} />
          <Text variant="caption" style={{ color: colors['nav.selected'], fontFamily: 'PlusJakartaSans_600SemiBold' }}>
            Publicidad
          </Text>
          <View style={[styles.dot, { backgroundColor: colors['text.tertiary'] }]} />
          <Text variant="caption" color="text.tertiary" numberOfLines={1} style={{ flex: 1 }}>
            {ad.advertiserName}
          </Text>
        </View>

        <Text variant="title" numberOfLines={2} style={styles.title}>{ad.title}</Text>
        {ad.description ? (
          <Text variant="body" color="text.secondary" numberOfLines={2} style={styles.description}>
            {ad.description}
          </Text>
        ) : null}

        <Button
          variant="primary"
          size="md"
          label={ad.ctaLabel || 'Ver más'}
          trailingIcon={<Ionicons name={CTA_ICONS[ad.ctaLabel] || 'arrow-forward'} size={16} color={colors['text.onAction']} />}
          onPress={handleCTA}
          style={styles.ctaButton}
        />
      </View>
    </View>
  );
}

export default memo(InternalAdCard);

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    marginHorizontal: space[4],
    marginBottom: space[4],
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  image: {
    width: '100%',
    height: 200,
  },
  body: {
    padding: space[4],
  },
  sponsoredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space[2],
    gap: space[1],
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  title: {
    marginBottom: space[2],
  },
  description: {
    marginBottom: space[4],
  },
  ctaButton: {
    alignSelf: 'flex-start',
    minWidth: 130,
  },
});

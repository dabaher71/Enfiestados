import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { recordClick, recordImpression } from '../services/adService';
import { safeOpenURL } from '../utils/security';

const CTA_ICONS = {
  'Ver más': 'arrow-forward',
  'Asistir': 'calendar',
  'Comprar': 'cart',
  'Visitar': 'globe',
};

function InternalAdCard({ ad, onEventPress }) {
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
    <View style={styles.card}>
      {ad.image ? (
        <Image
          source={{ uri: ad.image }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
      ) : null}

      <View style={styles.body}>
        <View style={styles.sponsoredRow}>
          <Ionicons name="megaphone" size={13} color="#6c5ce7" />
          <Text style={styles.sponsoredText}>Publicidad</Text>
          <View style={styles.dot} />
          <Text style={styles.advertiserName} numberOfLines={1}>
            {ad.advertiserName}
          </Text>
        </View>

        <Text style={styles.title} numberOfLines={2}>{ad.title}</Text>
        {ad.description ? (
          <Text style={styles.description} numberOfLines={2}>{ad.description}</Text>
        ) : null}

        <TouchableOpacity style={styles.ctaButton} onPress={handleCTA} activeOpacity={0.85}>
          <Text style={styles.ctaText}>{ad.ctaLabel || 'Ver más'}</Text>
          <Ionicons
            name={CTA_ICONS[ad.ctaLabel] || 'arrow-forward'}
            size={16}
            color="#fff"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default memo(InternalAdCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#2d2d44',
    borderRadius: 20,
    marginHorizontal: 15,
    marginBottom: 15,
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
    backgroundColor: '#1a1a2e',
  },
  body: {
    padding: 15,
  },
  sponsoredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 5,
  },
  sponsoredText: {
    color: '#6c5ce7',
    fontSize: 12,
    fontWeight: '600',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#555',
  },
  advertiserName: {
    color: '#888',
    fontSize: 12,
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
    lineHeight: 23,
    marginBottom: 6,
  },
  description: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6c5ce7',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
    alignSelf: 'flex-start',
    minWidth: 130,
  },
  ctaText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});

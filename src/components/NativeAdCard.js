import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

const AD_UNIT_ID = Platform.select({
  android: TestIds.BANNER,
  ios: TestIds.BANNER,
});

export default function NativeAdCard() {
  const [adError, setAdError] = useState(false);

  if (adError) {
    return (
      <View style={styles.fallbackCard}>
        <View style={styles.header}>
          <Ionicons name="megaphone" size={14} color="#6c5ce7" />
          <Text style={styles.sponsoredText}>Publicidad</Text>
        </View>
        <Text style={styles.fallbackTitle}>¡Descubre ofertas especiales!</Text>
        <Text style={styles.fallbackText}>
          Este espacio es para mostrar anuncios integrados en tu feed.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="megaphone" size={14} color="#6c5ce7" />
        <Text style={styles.sponsoredText}>Publicidad</Text>
      </View>
      <BannerAd
        unitId={AD_UNIT_ID}
        size={BannerAdSize.MEDIUM_RECTANGLE}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdFailedToLoad={(error) => {
          console.log('Ad failed to load:', error);
          setAdError(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 15,
    alignItems: 'center',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 10,
    gap: 6,
  },
  sponsoredText: {
    color: '#6c5ce7',
    fontSize: 13,
    fontWeight: '600',
  },
  fallbackCard: {
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 15,
  },
  fallbackTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 6,
  },
  fallbackText: {
    color: '#aaa',
    fontSize: 14,
  },
});
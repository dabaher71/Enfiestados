import { memo, useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import Text from './ui/Text';

const AD_UNIT_ID = Platform.select({
  android: TestIds.BANNER,
  ios: TestIds.BANNER,
});

// Regla: un slot vacío no ocupa espacio (FIX_ROUND_1 § 1.2).
// Devuelve null hasta que el anuncio cargue o falle definitivamente.
function NativeAdCard() {
  const { colors } = useTheme();
  const [loaded,  setLoaded]  = useState(false);
  const [failed,  setFailed]  = useState(false);

  const handleLoad  = useCallback(() => setLoaded(true),  []);
  const handleError = useCallback(() => setFailed(true),  []);

  // No cargó y falló → sin espacio
  if (failed) return null;

  return (
    <View style={[
      styles.card,
      { backgroundColor: colors['bg.surface'] },
      !loaded && styles.hidden,   // oculto hasta que el SDK confirme carga
    ]}>
      <View style={styles.header}>
        <Text variant="caption" color="text.tertiary">Publicidad</Text>
      </View>
      <BannerAd
        unitId={AD_UNIT_ID}
        size={BannerAdSize.MEDIUM_RECTANGLE}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdLoaded={handleLoad}
        onAdFailedToLoad={handleError}
      />
    </View>
  );
}

export default memo(NativeAdCard);

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    marginHorizontal: space[5],
    marginVertical: space[3],
    padding: space[4],
    alignItems: 'center',
    overflow: 'hidden',
  },
  hidden: { opacity: 0, height: 0, marginVertical: 0, padding: 0 },
  header: { alignSelf: 'flex-start', marginBottom: space[2] },
});

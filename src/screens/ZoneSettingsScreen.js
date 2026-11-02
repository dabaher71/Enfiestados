import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Circle } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import Text from '../components/ui/Text';

import { buildMapStyle } from '../lib/mapStyle';
import {
  DEFAULT_RADIUS_KM, RADIUS_OPTIONS_KM, setZonePreference, useZonePreference,
} from '../lib/zonePreference';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { useTranslation } from 'react-i18next';

// San José como punto de partida si no hay zona guardada ni permiso de GPS.
const SAN_JOSE = { lat: 9.9281, lng: -84.0907 };

// Encuadre del mapa para que el círculo entre completo con algo de aire.
function regionFor(center, radiusKm) {
  const latDelta = (radiusKm * 2.6) / 111;
  const lngDelta = latDelta / Math.cos((center.lat * Math.PI) / 180);
  return { latitude: center.lat, longitude: center.lng, latitudeDelta: latDelta, longitudeDelta: lngDelta };
}

// El pin queda fijo en el centro de la pantalla y el usuario mueve el mapa
// debajo, como en las apps de transporte: es más fácil de acertar con el dedo
// que arrastrar un marcador, y en Android no tiene el problema del marcador
// que se recorta (ver PriceMarker en SearchScreen).
export default function ZoneSettingsScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const mapStyle = useMemo(() => buildMapStyle(colors, isDark), [colors, isDark]);
  const { zone, loaded } = useZonePreference();

  const mapRef = useRef(null);
  const [center,   setCenter]   = useState(null);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [locating, setLocating] = useState(false);
  const [saving,   setSaving]   = useState(false);

  // Punto inicial: la zona guardada; si no hay, San José. Se fija una sola
  // vez, cuando termina de leerse el storage.
  useEffect(() => {
    if (!loaded || center) return;
    if (zone) {
      setCenter({ lat: zone.lat, lng: zone.lng });
      setRadiusKm(zone.radiusKm);
    } else {
      setCenter(SAN_JOSE);
    }
  }, [loaded]);

  const changeRadius = (km) => {
    setRadiusKm(km);
    if (center) mapRef.current?.animateToRegion(regionFor(center, km), 300);
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('zone.noPermission'), t('zone.noPermissionMsg'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCenter(next);
      mapRef.current?.animateToRegion(regionFor(next, radiusKm), 400);
    } catch {
      Alert.alert(t('common.error'), t('zone.locationError'));
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    if (!center) return;
    setSaving(true);
    await setZonePreference({ lat: center.lat, lng: center.lng, radiusKm });
    setSaving(false);
    navigation.goBack();
  };

  const clear = async () => {
    await setZonePreference(null);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel={t('common.back')}>
          <Ionicons name="arrow-back" size={24} color={colors['text.primary']} />
        </Pressable>
        <Text variant="h2">{t('settings.zone')}</Text>
      </View>

      <View style={styles.mapWrap}>
        {center && (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={regionFor(center, radiusKm)}
            customMapStyle={mapStyle}
            showsUserLocation
            showsMyLocationButton={false}
            onRegionChange={r => setCenter({ lat: r.latitude, lng: r.longitude })}
          >
            <Circle
              center={{ latitude: center.lat, longitude: center.lng }}
              radius={radiusKm * 1000}
              strokeWidth={2}
              strokeColor={colors['action.primary']}
              // action.primary es #RRGGBB: se le agrega alfa (~15%) para el relleno.
              fillColor={`${colors['action.primary']}26`}
            />
          </MapView>
        )}

        {/* Pin fijo en el centro. La punta del ícono (abajo) es la que marca
            el punto, así que se sube media altura. pointerEvents="none" para
            que no tape los gestos del mapa. */}
        <View pointerEvents="none" style={styles.pinOverlay}>
          <Ionicons name="location" size={44} color={colors['action.primary']} style={styles.pinIcon} />
        </View>

        <Pressable
          onPress={useMyLocation}
          disabled={locating}
          style={[styles.locateBtn, { backgroundColor: colors['bg.raised'] }]}
          accessibilityRole="button"
          accessibilityLabel={t('zone.useMyLocation')}
        >
          <Ionicons name={locating ? 'hourglass-outline' : 'locate-outline'} size={22} color={colors['nav.selected']} />
        </Pressable>
      </View>

      <View style={[styles.panel, { backgroundColor: colors['bg.raised'] }]}>
        <Text variant="body" color="text.secondary">
          {t('zone.help')}
        </Text>

        <Text variant="label" style={styles.radiusLabel}>{t('zone.distance')}</Text>
        <View style={styles.chips}>
          {RADIUS_OPTIONS_KM.map(km => (
            <Chip key={km} label={`${km} km`} selected={radiusKm === km} onPress={() => changeRadius(km)} />
          ))}
        </View>

        <Button variant="primary" size="lg" label={t('zone.save')} onPress={save} loading={saving} fullWidth style={styles.saveBtn} />
        {zone && (
          <Button variant="ghost" size="sm" label={t('zone.wholeCountry')} onPress={clear} fullWidth />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[5], paddingVertical: space[4], gap: space[3] },
  back:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  mapWrap: { flex: 1 },
  pinOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinIcon: { marginBottom: 44 },
  locateBtn: {
    position: 'absolute',
    right: space[4],
    bottom: space[4],
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  panel: {
    paddingHorizontal: space[5],
    paddingTop: space[4],
    paddingBottom: space[3],
    // Sin margen negativo sobre el mapa: taparía el logo de Google, que los
    // términos de Maps exigen que quede visible.
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  radiusLabel: { marginTop: space[4], marginBottom: space[2] },
  chips:   { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  saveBtn: { marginTop: space[5], marginBottom: space[1] },
});

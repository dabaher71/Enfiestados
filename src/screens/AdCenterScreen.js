// AdCenterScreen — Centro de Anuncios
// § 2.1: tokens. § 2.2: CTA amarillo. § 2.5: ceros ocultos, "Clics".
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getMyAds, pauseAd, resumeAd } from '../services/adService';

import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/Skeleton';
import Text from '../components/ui/Text';
import { useTheme } from '../theme/ThemeProvider';
import { elev, radius, space } from '../theme/tokens';

const STATUS_CONFIG = {
  active:   { label: 'Activo',      tint: 'status.free' },
  pending:  { label: 'En revisión', tint: 'status.warning' },
  paused:   { label: 'Pausado',     tint: 'text.tertiary' },
  rejected: { label: 'Rechazado',   tint: 'status.urgent' },
};

function ctr(imps, clicks) {
  if (!imps || !clicks) return null;
  return `${((clicks / imps) * 100).toFixed(1)}%`;
}

export default function AdCenterScreen({ navigation }) {
  const { colors } = useTheme();
  const [ads,       setAds]       = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [credits,   setCredits]   = useState(0);
  const userId = auth.currentUser?.uid;

  const loadData = useCallback(async () => {
    try {
      const [myAds, userSnap] = await Promise.all([
        getMyAds(userId),
        getDoc(doc(db, 'users', userId)),
      ]);
      setAds(myAds);
      setCredits(userSnap.data()?.adCredits || 0);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleTogglePause = async (ad) => {
    const action = ad.status === 'active' ? pauseAd : resumeAd;
    const label  = ad.status === 'active' ? 'Pausar' : 'Reactivar';
    Alert.alert(label, `¿${label} "${ad.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: label, onPress: async () => { await action(ad.id); loadData(); } },
    ]);
  };

  // Stats totales — solo si hay datos reales
  const totalImps   = ads.reduce((s, a) => s + (a.impressions || 0), 0);
  const totalClics  = ads.reduce((s, a) => s + (a.clicks || 0), 0);
  const activeCount = ads.filter(a => a.status === 'active').length;
  const hasMetrics  = totalImps > 0 || totalClics > 0 || activeCount > 0;

  const renderAd = ({ item }) => {
    const s = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const itemCtr = ctr(item.impressions, item.clicks);
    return (
      <View style={[styles.adCard, { backgroundColor: colors['bg.surface'] }, elev[1]]}>
        <View style={styles.adHeader}>
          <View style={{ flex: 1 }}>
            <Text variant="title" numberOfLines={1}>{item.title}</Text>
            <View style={styles.statusRow}>
              <Ionicons name="ellipse" size={8} color={colors[s.tint]} />
              <Text variant="caption" style={{ color: colors[s.tint] }}>{s.label}</Text>
            </View>
          </View>
          {(item.status === 'active' || item.status === 'paused') && (
            <Pressable onPress={() => handleTogglePause(item)} style={styles.iconBtn} accessibilityRole="button">
              <Ionicons
                name={item.status === 'active' ? 'pause-circle-outline' : 'play-circle-outline'}
                size={26}
                color={colors['text.tertiary']}
              />
            </Pressable>
          )}
        </View>

        {item.status === 'rejected' && item.rejectionReason ? (
          <View style={[styles.rejectionBox, { backgroundColor: colors['status.urgent.bg'] }]}>
            <Ionicons name="information-circle-outline" size={14} color={colors['status.urgent']} />
            <Text variant="caption" style={{ color: colors['status.urgent'], flex: 1 }}>{item.rejectionReason}</Text>
          </View>
        ) : null}

        {/* Métricas — solo si hay datos (§ 2.5: ceros no se muestran como dato) */}
        {(item.impressions > 0 || item.clicks > 0) && (
          <View style={[styles.metricsRow, { backgroundColor: colors['bg.base'] }]}>
            {item.impressions > 0 && (
              <View style={styles.metric}>
                <Text variant="h3">{item.impressions.toLocaleString('es-CR')}</Text>
                <Text variant="caption" color="text.tertiary">Impresiones</Text>
              </View>
            )}
            {item.clicks > 0 && (
              <View style={styles.metric}>
                <Text variant="h3">{item.clicks.toLocaleString('es-CR')}</Text>
                <Text variant="caption" color="text.tertiary">Clics</Text>
              </View>
            )}
            {itemCtr && (
              <View style={styles.metric}>
                <Text variant="h3">{itemCtr}</Text>
                <Text variant="caption" color="text.tertiary">CTR</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  if (loading) return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors['text.primary']} />
        </Pressable>
        <Text variant="h2">Centro de Anuncios</Text>
      </View>
      <SkeletonList count={3} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors['text.primary']} />
        </Pressable>
        <Text variant="h2" style={{ flex: 1 }}>Centro de Anuncios</Text>
        {/* CTA amarillo (§ 2.2) */}
        <Button variant="primary" size="sm" label="Crear anuncio"
          leadingIcon={<Ionicons name="add" size={16} color={colors['text.onAction']} />}
          onPress={() => navigation.navigate('CreateAd')} />
      </View>

      {/* Resumen — solo si hay métricas reales (§ 2.5) */}
      {hasMetrics && (
        <View style={[styles.statsRow, { borderBottomColor: colors['border.subtle'] }]}>
          {activeCount > 0 && (
            <View style={styles.statCell}>
              <Text style={{ fontSize: 22, fontFamily: 'BricolageGrotesque_700Bold', color: colors['text.primary'] }}>{activeCount}</Text>
              <Text variant="caption" color="text.tertiary">Activos</Text>
            </View>
          )}
          {totalImps > 0 && (
            <View style={styles.statCell}>
              <Text style={{ fontSize: 22, fontFamily: 'BricolageGrotesque_700Bold', color: colors['text.primary'] }}>{totalImps.toLocaleString('es-CR')}</Text>
              <Text variant="caption" color="text.tertiary">Impresiones</Text>
            </View>
          )}
          {totalClics > 0 && (
            <View style={styles.statCell}>
              <Text style={{ fontSize: 22, fontFamily: 'BricolageGrotesque_700Bold', color: colors['text.primary'] }}>{totalClics.toLocaleString('es-CR')}</Text>
              <Text variant="caption" color="text.tertiary">Clics</Text>
            </View>
          )}
          {credits > 0 && (
            <View style={[styles.statCell, { borderLeftWidth: 1, borderLeftColor: colors['border.subtle'] }]}>
              <Text style={{ fontSize: 22, fontFamily: 'BricolageGrotesque_700Bold', color: colors['action.primary'] }}>₡{credits.toLocaleString('es-CR')}</Text>
              <Text variant="caption" color="text.tertiary">Créditos</Text>
            </View>
          )}
        </View>
      )}

      <FlatList
        data={ads}
        keyExtractor={item => item.id}
        renderItem={renderAd}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors['action.primary']} />
        }
        ListEmptyComponent={
          <EmptyState
            icon={<Ionicons name="megaphone-outline" size={28} color={colors['text.tertiary']} />}
            title="Sin anuncios todavía"
            description="Creá tu primer anuncio y llegá a tu audiencia en Costa Rica."
            actionLabel="Crear anuncio"
            onAction={() => navigation.navigate('CreateAd')}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1 },
  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[5], paddingVertical: space[4], gap: space[3] },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', paddingHorizontal: space[5], paddingBottom: space[4], borderBottomWidth: StyleSheet.hairlineWidth, gap: space[4] },
  statCell: { alignItems: 'center', gap: 2 },
  list:    { paddingHorizontal: space[5], paddingVertical: space[3], gap: space[3], paddingBottom: space[12] },
  adCard:  { borderRadius: radius.lg, overflow: 'hidden', padding: space[4] },
  adHeader:{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: space[3] },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space[1], marginTop: 3 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  rejectionBox: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: radius.sm, padding: space[3], marginBottom: space[3], gap: space[2] },
  metricsRow: { flexDirection: 'row', borderRadius: radius.md, paddingVertical: space[3], marginTop: space[2] },
  metric: { flex: 1, alignItems: 'center', gap: 2 },
});

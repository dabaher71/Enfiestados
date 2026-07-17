import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getMyAds, pauseAd, resumeAd } from '../services/adService';

const STATUS_CONFIG = {
  active:   { label: 'Activo',    color: '#00b894', icon: 'checkmark-circle' },
  pending:  { label: 'En revisión', color: '#fdcb6e', icon: 'time' },
  paused:   { label: 'Pausado',   color: '#636e72', icon: 'pause-circle' },
  rejected: { label: 'Rechazado', color: '#e17055', icon: 'close-circle' },
};

function ctr(impressions, clicks) {
  if (!impressions) return '0%';
  return ((clicks / impressions) * 100).toFixed(1) + '%';
}

export default function AdCenterScreen({ navigation }) {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [credits, setCredits] = useState(0);
  const userId = auth.currentUser?.uid;

  const loadData = useCallback(async () => {
    try {
      const [myAds, userSnap] = await Promise.all([
        getMyAds(userId),
        getDoc(doc(db, 'users', userId)),
      ]);
      setAds(myAds);
      setCredits(userSnap.data()?.adCredits || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleTogglePause = async (ad) => {
    const action = ad.status === 'active' ? pauseAd : resumeAd;
    const label = ad.status === 'active' ? 'pausar' : 'reactivar';
    Alert.alert(
      `¿${label.charAt(0).toUpperCase() + label.slice(1)} anuncio?`,
      `¿Querés ${label} "${ad.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: label.charAt(0).toUpperCase() + label.slice(1),
          onPress: async () => {
            await action(ad.id);
            loadData();
          },
        },
      ]
    );
  };

  const totalImpressions = ads.reduce((s, a) => s + (a.impressions || 0), 0);
  const totalClicks = ads.reduce((s, a) => s + (a.clicks || 0), 0);
  const activeCount = ads.filter(a => a.status === 'active').length;

  const renderAd = ({ item }) => {
    const s = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    return (
      <View style={styles.adCard}>
        <View style={styles.adHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.adTitle} numberOfLines={1}>{item.title}</Text>
            <View style={styles.statusRow}>
              <Ionicons name={s.icon} size={14} color={s.color} />
              <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
            </View>
          </View>
          {(item.status === 'active' || item.status === 'paused') && (
            <TouchableOpacity onPress={() => handleTogglePause(item)} style={styles.iconBtn}>
              <Ionicons
                name={item.status === 'active' ? 'pause-circle-outline' : 'play-circle-outline'}
                size={26}
                color="#aaa"
              />
            </TouchableOpacity>
          )}
        </View>

        {item.status === 'rejected' && item.rejectionReason ? (
          <View style={styles.rejectionBox}>
            <Ionicons name="information-circle" size={14} color="#e17055" />
            <Text style={styles.rejectionText}>{item.rejectionReason}</Text>
          </View>
        ) : null}

        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{(item.impressions || 0).toLocaleString()}</Text>
            <Text style={styles.metricLabel}>Impresiones</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{(item.clicks || 0).toLocaleString()}</Text>
            <Text style={styles.metricLabel}>Clicks</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{ctr(item.impressions, item.clicks)}</Text>
            <Text style={styles.metricLabel}>CTR</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator color="#6c5ce7" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Centro de Anuncios</Text>
        <TouchableOpacity
          style={styles.newAdBtn}
          onPress={() => navigation.navigate('CreateAd')}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.newAdText}>Nuevo</Text>
        </TouchableOpacity>
      </View>

      {/* Stats globales */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{activeCount}</Text>
          <Text style={styles.statLabel}>Activos</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalImpressions.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Impresiones</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalClicks.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Clicks</Text>
        </View>
        <View style={[styles.statCard, styles.creditsCard]}>
          <Text style={[styles.statValue, styles.creditsValue]}>{credits.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Créditos</Text>
        </View>
      </View>

      <FlatList
        data={ads}
        keyExtractor={item => item.id}
        renderItem={renderAd}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#6c5ce7" />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="megaphone-outline" size={56} color="#3d3d54" />
            <Text style={styles.emptyTitle}>Sin anuncios aún</Text>
            <Text style={styles.emptyText}>Creá tu primer anuncio y llegá a tu audiencia.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('CreateAd')}>
              <Text style={styles.emptyBtnText}>Crear anuncio</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
  },
  backBtn: { padding: 4, marginRight: 12 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', flex: 1 },
  newAdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6c5ce7',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 4,
  },
  newAdText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  creditsCard: { borderWidth: 1, borderColor: '#6c5ce7' },
  statValue: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  creditsValue: { color: '#6c5ce7' },
  statLabel: { color: '#888', fontSize: 10, marginTop: 3 },
  list: { paddingHorizontal: 15, paddingBottom: 30 },
  adCard: {
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  adHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  adTitle: { color: '#fff', fontWeight: 'bold', fontSize: 15, marginBottom: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusText: { fontSize: 12, fontWeight: '600' },
  iconBtn: { padding: 4 },
  rejectionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#3d2020',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    gap: 6,
  },
  rejectionText: { color: '#e17055', fontSize: 12, flex: 1 },
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    paddingVertical: 10,
  },
  metric: { flex: 1, alignItems: 'center' },
  metricValue: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  metricLabel: { color: '#888', fontSize: 11, marginTop: 2 },
  metricDivider: { width: 1, backgroundColor: '#2d2d44' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { color: '#fff', fontWeight: 'bold', fontSize: 18, marginTop: 14, marginBottom: 8 },
  emptyText: { color: '#888', fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  emptyBtn: {
    marginTop: 20,
    backgroundColor: '#6c5ce7',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700' },
});

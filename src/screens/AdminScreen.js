import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import {
  approveAd,
  approveAdvertiserRequest,
  getPendingAds,
  getPendingAdvertiserRequests,
  rejectAd,
  rejectAdvertiserRequest,
} from '../services/adService';

const TABS = ['Reportes', 'Anuncios', 'Solicitudes', 'Usuarios'];

export default function AdminScreen({ navigation }) {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reports, setReports] = useState([]);
  const [pendingAds, setPendingAds] = useState([]);
  const [adRequests, setAdRequests] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [foundUsers, setFoundUsers] = useState([]);
  const [searching, setSearching] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [rSnap, ads, requests] = await Promise.all([
        getDocs(query(collection(db, 'reports'), where('status', '==', 'pending'), orderBy('createdAt'), limit(50))),
        getPendingAds(),
        getPendingAdvertiserRequests(),
      ]);
      setReports(rSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setPendingAds(ads);
      setAdRequests(requests);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleReportAction = (reportId, targetId, targetType, action) => {
    const labels = {
      dismiss: 'Desestimar',
      warn: 'Advertir al usuario',
      delete_content: 'Eliminar contenido',
      ban: 'Banear usuario',
    };
    Alert.alert(labels[action], '¿Confirmar esta acción?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        style: action === 'ban' || action === 'delete_content' ? 'destructive' : 'default',
        onPress: async () => {
          try {
            const fn = httpsCallable(functions, 'processReportAction');
            await fn({ reportId, targetId, targetType, action });
            setReports(prev => prev.filter(r => r.id !== reportId));
          } catch {
            Alert.alert('Error', 'No se pudo procesar la acción.');
          }
        },
      },
    ]);
  };

  const handleApproveAd = async (adId) => {
    await approveAd(adId);
    setPendingAds(prev => prev.filter(a => a.id !== adId));
  };

  const handleRejectAd = (adId) => {
    Alert.prompt(
      'Rechazar anuncio',
      'Indicá el motivo del rechazo (se enviará al anunciante):',
      async (reason) => {
        if (!reason?.trim()) return;
        await rejectAd(adId, reason.trim());
        setPendingAds(prev => prev.filter(a => a.id !== adId));
      },
      'plain-text',
      '',
    );
  };

  const handleApproveRequest = async (req) => {
    await approveAdvertiserRequest(req.id, req.userId);
    setAdRequests(prev => prev.filter(r => r.id !== req.id));
    Alert.alert('Aprobado', `${req.businessName} ahora tiene cuenta de anunciante.`);
  };

  const handleRejectRequest = async (reqId) => {
    await rejectAdvertiserRequest(reqId);
    setAdRequests(prev => prev.filter(r => r.id !== reqId));
  };

  const searchUsers = async () => {
    if (!userSearch.trim()) return;
    setSearching(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('name', '>=', userSearch.trim()),
        where('name', '<=', userSearch.trim() + '\uf8ff'),
        limit(10)
      );
      const snap = await getDocs(q);
      setFoundUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } finally {
      setSearching(false);
    }
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
        <Text style={styles.headerTitle}>Panel Admin</Text>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContent}>
        {TABS.map((t, i) => {
          const badge = i === 0 ? reports.length : i === 1 ? pendingAds.length : i === 2 ? adRequests.length : 0;
          return (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === i && styles.tabActive]}
              onPress={() => setTab(i)}
            >
              <Text style={[styles.tabText, tab === i && styles.tabTextActive]}>{t}</Text>
              {badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={
          tab === 0 ? reports :
          tab === 1 ? pendingAds :
          tab === 2 ? adRequests :
          foundUsers
        }
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          tab < 3 ? (
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} tintColor="#6c5ce7" />
          ) : undefined
        }
        ListHeaderComponent={tab === 3 ? (
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar usuario por nombre..."
              placeholderTextColor="#555"
              value={userSearch}
              onChangeText={setUserSearch}
              onSubmitEditing={searchUsers}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchBtn} onPress={searchUsers}>
              {searching ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="search" size={20} color="#fff" />}
            </TouchableOpacity>
          </View>
        ) : null}
        renderItem={({ item }) => {
          if (tab === 0) return <ReportItem item={item} onAction={handleReportAction} />;
          if (tab === 1) return <AdItem item={item} onApprove={handleApproveAd} onReject={handleRejectAd} />;
          if (tab === 2) return <RequestItem item={item} onApprove={handleApproveRequest} onReject={handleRejectRequest} />;
          return <UserItem item={item} navigation={navigation} />;
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={50} color="#3d3d54" />
            <Text style={styles.emptyText}>
              {tab === 3 ? 'Buscá un usuario arriba' : 'Todo al día'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function ReportItem({ item, onAction }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.typePill}>
          <Text style={styles.typePillText}>{item.targetType}</Text>
        </View>
        <Text style={styles.cardMeta}>{item.reason}</Text>
      </View>
      <Text style={styles.cardId} numberOfLines={1}>ID: {item.targetId}</Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity style={[styles.actionBtn, styles.dismissBtn]} onPress={() => onAction(item.id, item.targetId, item.targetType, 'dismiss')}>
          <Text style={styles.actionBtnText}>Desestimar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.warnBtn]} onPress={() => onAction(item.id, item.targetId, item.targetType, 'warn')}>
          <Text style={styles.actionBtnText}>Advertir</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => onAction(item.id, item.targetId, item.targetType, 'delete_content')}>
          <Text style={styles.actionBtnText}>Eliminar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.banBtn]} onPress={() => onAction(item.id, item.targetId, item.targetType, 'ban')}>
          <Text style={styles.actionBtnText}>Ban</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AdItem({ item, onApprove, onReject }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardMeta}>{item.advertiserName} · {item.type === 'event' ? 'Evento' : 'Externo'}</Text>
      {item.description ? <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text> : null}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => onApprove(item.id)}>
          <Ionicons name="checkmark" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Aprobar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.banBtn]} onPress={() => onReject(item.id)}>
          <Ionicons name="close" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Rechazar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function RequestItem({ item, onApprove, onReject }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.businessName}</Text>
      <Text style={styles.cardMeta}>{item.businessType} · {item.contact}</Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => onApprove(item)}>
          <Ionicons name="checkmark" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Aprobar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.banBtn]} onPress={() => onReject(item.id)}>
          <Ionicons name="close" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Rechazar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function UserItem({ item, navigation }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
    >
      <Text style={styles.cardTitle}>{item.name}</Text>
      <Text style={styles.cardMeta}>{item.email}</Text>
      <View style={styles.userBadges}>
        {item.isAdmin && <View style={[styles.userBadge, { backgroundColor: '#6c5ce7' }]}><Text style={styles.userBadgeText}>Admin</Text></View>}
        {item.isAdvertiser && <View style={[styles.userBadge, { backgroundColor: '#00b894' }]}><Text style={styles.userBadgeText}>Anunciante</Text></View>}
        {item.banned && <View style={[styles.userBadge, { backgroundColor: '#e17055' }]}><Text style={styles.userBadgeText}>Baneado</Text></View>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, gap: 15 },
  backBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  tabsScroll: { flexGrow: 0, marginBottom: 8 },
  tabsContent: { paddingHorizontal: 15, gap: 8, paddingVertical: 4 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#2d2d44', gap: 6 },
  tabActive: { backgroundColor: '#6c5ce7' },
  tabText: { color: '#888', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#fff' },
  badge: { backgroundColor: '#e74c3c', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  list: { paddingHorizontal: 15, paddingBottom: 30 },
  card: { backgroundColor: '#2d2d44', borderRadius: 14, padding: 14, marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  typePill: { backgroundColor: '#3d3d54', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  typePillText: { color: '#aaa', fontSize: 11, fontWeight: '600' },
  cardTitle: { color: '#fff', fontWeight: 'bold', fontSize: 15, marginBottom: 4 },
  cardMeta: { color: '#888', fontSize: 13 },
  cardDesc: { color: '#aaa', fontSize: 13, marginTop: 4 },
  cardId: { color: '#555', fontSize: 11, marginBottom: 10 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, gap: 4 },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  dismissBtn: { backgroundColor: '#636e72' },
  warnBtn: { backgroundColor: '#fdcb6e' },
  deleteBtn: { backgroundColor: '#e17055' },
  banBtn: { backgroundColor: '#d63031' },
  approveBtn: { backgroundColor: '#00b894' },
  userBadges: { flexDirection: 'row', gap: 6, marginTop: 8 },
  userBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  userBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  searchInput: { flex: 1, backgroundColor: '#2d2d44', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 14 },
  searchBtn: { backgroundColor: '#6c5ce7', borderRadius: 12, width: 46, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: 50, gap: 12 },
  emptyText: { color: '#555', fontSize: 14 },
});

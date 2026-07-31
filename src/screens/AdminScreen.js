// AdminScreen — Panel de administración
// LÓGICA INTACTA: reportes, aprobación de anuncios/solicitudes, búsqueda de usuarios.
// PRESENTACIÓN: FIX_ROUND_4 § 1 — tokens completos, SegmentedControl, Button, StatusBadge.
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
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

import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { SkeletonList } from '../components/ui/Skeleton';
import StatusBadge from '../components/ui/StatusBadge';
import Text from '../components/ui/Text';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';

const TAB_LABELS = ['Reportes', 'Anuncios', 'Solicitudes', 'Usuarios'];

export default function AdminScreen({ navigation }) {
  const { colors } = useTheme();
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
        where('name', '<=', userSearch.trim() + ''),
        limit(10)
      );
      const snap = await getDocs(q);
      setFoundUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } finally {
      setSearching(false);
    }
  };

  const TABS = TAB_LABELS.map((label, i) => ({
    label,
    value: i,
    badge: i === 0 ? reports.length : i === 1 ? pendingAds.length : i === 2 ? adRequests.length : 0,
  }));

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors['bg.base'] }]} edges={['top']}>
        <View style={styles.header}>
          <Text variant="h2">Panel Admin</Text>
        </View>
        <SkeletonList count={4} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors['bg.base'] }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={colors['text.primary']} />
        </Pressable>
        <Text variant="h2">Panel Admin</Text>
      </View>

      <View style={styles.tabsWrap}>
        <SegmentedControl options={TABS} selected={tab} onSelect={setTab} />
      </View>

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
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} tintColor={colors['nav.selected']} />
          ) : undefined
        }
        ListHeaderComponent={tab === 3 ? (
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.searchInput, { backgroundColor: colors['bg.surface'], borderColor: colors['border.strong'], color: colors['text.primary'] }]}
              placeholder="Buscar usuario por nombre..."
              placeholderTextColor={colors['text.tertiary']}
              value={userSearch}
              onChangeText={setUserSearch}
              onSubmitEditing={searchUsers}
              returnKeyType="search"
            />
            <Pressable style={[styles.searchBtn, { backgroundColor: colors['action.primary'] }]} onPress={searchUsers} accessibilityLabel="Buscar">
              {searching ? <ActivityIndicator size="small" color={colors['text.onAction']} /> : <Ionicons name="search" size={20} color={colors['text.onAction']} />}
            </Pressable>
          </View>
        ) : null}
        renderItem={({ item }) => {
          if (tab === 0) return <ReportItem item={item} onAction={handleReportAction} />;
          if (tab === 1) return <AdItem item={item} onApprove={handleApproveAd} onReject={handleRejectAd} />;
          if (tab === 2) return <RequestItem item={item} onApprove={handleApproveRequest} onReject={handleRejectRequest} />;
          return <UserItem item={item} navigation={navigation} />;
        }}
        ListEmptyComponent={
          <EmptyState
            icon={<Ionicons name="checkmark-circle-outline" size={28} color={colors['text.tertiary']} />}
            title={tab === 3 ? 'Buscá un usuario arriba' : 'Todo al día'}
          />
        }
      />
    </SafeAreaView>
  );
}

function ReportItem({ item, onAction }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors['bg.surface'] }]}>
      <View style={styles.cardRow}>
        <StatusBadge label={item.targetType} variant="neutral" />
        <Text variant="caption" color="text.secondary">{item.reason}</Text>
      </View>
      <Text variant="caption" color="text.tertiary" numberOfLines={1} style={styles.cardId}>ID: {item.targetId}</Text>
      <View style={styles.actionsRow}>
        <Button variant="secondary" size="sm" label="Desestimar" onPress={() => onAction(item.id, item.targetId, item.targetType, 'dismiss')} />
        <Button variant="secondary" size="sm" label="Advertir" onPress={() => onAction(item.id, item.targetId, item.targetType, 'warn')} />
        <Button variant="destructive" size="sm" label="Eliminar" onPress={() => onAction(item.id, item.targetId, item.targetType, 'delete_content')} />
        <Button variant="destructive" size="sm" label="Ban" onPress={() => onAction(item.id, item.targetId, item.targetType, 'ban')} />
      </View>
    </View>
  );
}

function AdItem({ item, onApprove, onReject }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors['bg.surface'] }]}>
      <Text variant="title">{item.title}</Text>
      <Text variant="caption" color="text.tertiary" style={styles.cardMeta}>
        {item.advertiserName} · {item.type === 'event' ? 'Evento' : 'Externo'}
      </Text>
      {item.description ? (
        <Text variant="caption" color="text.secondary" numberOfLines={2} style={styles.cardDesc}>{item.description}</Text>
      ) : null}
      <View style={styles.actionsRow}>
        <Button variant="primary" size="sm" label="Aprobar" leadingIcon={<Ionicons name="checkmark" size={16} color={colors['text.onAction']} />} onPress={() => onApprove(item.id)} />
        <Button variant="destructive" size="sm" label="Rechazar" leadingIcon={<Ionicons name="close" size={16} color={colors['status.urgent']} />} onPress={() => onReject(item.id)} />
      </View>
    </View>
  );
}

function RequestItem({ item, onApprove, onReject }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors['bg.surface'] }]}>
      <Text variant="title">{item.businessName}</Text>
      <Text variant="caption" color="text.tertiary" style={styles.cardMeta}>{item.businessType} · {item.contact}</Text>
      <View style={styles.actionsRow}>
        <Button variant="primary" size="sm" label="Aprobar" leadingIcon={<Ionicons name="checkmark" size={16} color={colors['text.onAction']} />} onPress={() => onApprove(item)} />
        <Button variant="destructive" size="sm" label="Rechazar" leadingIcon={<Ionicons name="close" size={16} color={colors['status.urgent']} />} onPress={() => onReject(item.id)} />
      </View>
    </View>
  );
}

function UserItem({ item, navigation }) {
  const { colors } = useTheme();
  return (
    <Pressable
      style={[styles.card, { backgroundColor: colors['bg.surface'] }]}
      onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
    >
      <Text variant="title">{item.name}</Text>
      <Text variant="caption" color="text.tertiary" style={styles.cardMeta}>{item.email}</Text>
      <View style={styles.userBadges}>
        {item.isAdmin && <StatusBadge label="Admin" variant="promo" />}
        {item.isAdvertiser && <StatusBadge label="Anunciante" variant="free" />}
        {item.banned && <StatusBadge label="Baneado" variant="urgent" />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[5], paddingTop: space[1], paddingBottom: space[3], gap: space[3] },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -space[2] },
  tabsWrap: { paddingHorizontal: space[5], marginBottom: space[2] },

  list: { paddingHorizontal: space[5], paddingBottom: space[8] },
  card: { borderRadius: radius.lg, padding: space[4], marginBottom: space[3] },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginBottom: space[2] },
  cardMeta: { marginTop: 2 },
  cardDesc: { marginTop: space[1] },
  cardId: { marginBottom: space[2] },
  actionsRow: { flexDirection: 'row', gap: space[2], marginTop: space[3], flexWrap: 'wrap' },

  userBadges: { flexDirection: 'row', gap: space[2], marginTop: space[2] },

  searchRow: { flexDirection: 'row', gap: space[2], marginBottom: space[4] },
  searchInput: { flex: 1, height: 48, borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: space[3], fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular' },
  searchBtn: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});

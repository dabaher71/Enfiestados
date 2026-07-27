// NotificationsScreen — Notificaciones · Solicitudes
// Mensajes movido a MessagesScreen (design system § 5.1).
// LÓGICA INTACTA: suscripciones, mark-as-read, accept/reject follow.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { arrayRemove, arrayUnion, doc, getDoc, updateDoc } from 'firebase/firestore';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { ActivityIndicator, Alert, Animated, Pressable, StyleSheet, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/Skeleton';
import Text from '../components/ui/Text';
import { UnderlineTabs } from '../components/ui/SegmentedControl';

import { auth, db } from '../config/firebase';
import { createNotification, deleteNotification, markAllAsRead, markAsRead, NOTIFICATION_TYPES, subscribeToNotifications } from '../services/notificationService';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import t from '../i18n/es-CR.json';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Colores de íconos de notificación usando los valores semánticos de los tokens
function getNotifIcon(type, colors) {
  switch (type) {
    case NOTIFICATION_TYPES.LIKE:            return { name: 'heart',               color: colors['status.urgent'] };
    case NOTIFICATION_TYPES.COMMENT:         return { name: 'chatbubble',           color: colors['status.info'] };
    case NOTIFICATION_TYPES.FOLLOW:          return { name: 'person-add',           color: colors['nav.selected'] };
    case NOTIFICATION_TYPES.FOLLOW_REQUEST:  return { name: 'person-add-outline',   color: colors['action.primary'] };
    case NOTIFICATION_TYPES.FOLLOW_ACCEPTED: return { name: 'checkmark-circle',     color: colors['status.free'] };
    case NOTIFICATION_TYPES.ATTEND:          return { name: 'calendar',             color: colors['status.free'] };
    case NOTIFICATION_TYPES.POST_LIKE:       return { name: 'heart',               color: colors['status.urgent'] };
    case NOTIFICATION_TYPES.POST_COMMENT:    return { name: 'chatbubble-ellipses',  color: colors['status.info'] };
    case NOTIFICATION_TYPES.NEW_EVENT:       return { name: 'calendar-outline',     color: colors['nav.selected'] };
    case NOTIFICATION_TYPES.NEW_POST:        return { name: 'images-outline',       color: colors['status.free'] };
    default:                                 return { name: 'notifications',         color: colors['text.tertiary'] };
  }
}

function formatRelTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr);
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'Ahora';
  if (m < 60) return `${m}m`;
  if (h < 24) return `${h}h`;
  if (d < 7)  return `${d}d`;
  return new Date(dateStr).toLocaleDateString('es-CR');
}

// ─── NotificationItem ─────────────────────────────────────────────────────────

const NotificationItem = memo(function NotificationItem({ item, onPress, onDelete, colors }) {
  const swipeRef = useRef(null);
  const icon = getNotifIcon(item.type, colors);

  const renderRight = (progress, dragX) => {
    const scale = dragX.interpolate({ inputRange: [-72, 0], outputRange: [1, 0], extrapolate: 'clamp' });
    return (
      <Pressable
        style={[styles.swipeDelete, { backgroundColor: colors['status.urgent'] }]}
        onPress={() => { swipeRef.current?.close(); onDelete(item.id); }}
        accessibilityLabel="Eliminar notificación"
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons name="trash-outline" size={20} color="#fff" />
        </Animated.View>
      </Pressable>
    );
  };

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRight} overshootRight={false}>
      <Pressable
        onPress={() => onPress(item)}
        style={[
          styles.notifRow,
          { borderBottomColor: colors['border.subtle'] },
          !item.read && { backgroundColor: `${colors['nav.selected']}14` },
        ]}
      >
        <View style={styles.avatarWrap}>
          <Avatar uri={item.fromUserAvatar} name={item.fromUserName} size={44} />
          <View style={[styles.iconBadge, { backgroundColor: icon.color }]}>
            <Ionicons name={icon.name} size={11} color="#fff" />
          </View>
        </View>
        <View style={styles.notifContent}>
          <Text variant="body" numberOfLines={2}>
            <Text variant="bodyStrong">{item.fromUserName} </Text>
            {item.message}
          </Text>
          <Text variant="caption" color="text.tertiary" style={{ marginTop: 3 }}>
            {formatRelTime(item.createdAt)}
          </Text>
        </View>
        {!item.read && (
          <View style={[styles.unreadDot, { backgroundColor: colors['nav.selected'] }]} />
        )}
      </Pressable>
    </Swipeable>
  );
});

// ─── FollowRequestItem ────────────────────────────────────────────────────────

const FollowRequestItem = memo(function FollowRequestItem({ item, onAccept, onReject, onNavigate, colors }) {
  const [processing, setProcessing] = useState(false);

  const handle = async (fn) => {
    setProcessing(true);
    await fn(item);
    setProcessing(false);
  };

  return (
    <View style={[styles.requestRow, { borderBottomColor: colors['border.subtle'] }]}>
      <Pressable style={styles.requestUser} onPress={() => onNavigate(item)}>
        <Avatar uri={item.fromUserAvatar} name={item.fromUserName} size={48} />
        <View style={styles.requestInfo}>
          <Text variant="title" numberOfLines={1}>{item.fromUserName}</Text>
          <Text variant="caption" color="text.tertiary">Quiere seguirte</Text>
        </View>
      </Pressable>
      {processing ? (
        <ActivityIndicator color={colors['action.primary']} />
      ) : (
        <View style={styles.requestBtns}>
          <Button variant="primary" size="sm" label="Aceptar" onPress={() => handle(onAccept)} />
          <Button variant="secondary" size="sm" label="Rechazar" onPress={() => handle(onReject)} />
        </View>
      )}
    </View>
  );
});

// ─── NotificationsScreen ──────────────────────────────────────────────────────

const TABS = [
  { label: t.alerts.tabs.notifications, value: 'notificaciones' },
  { label: t.alerts.tabs.requests,      value: 'solicitudes' },
];

export default function NotificationsScreen({ navigation }) {
  const { colors } = useTheme();
  const [tab, setTab] = useState('notificaciones');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const userId = auth.currentUser?.uid;

  useFocusEffect(useCallback(() => {
    if (userId && tab === 'notificaciones') {
      const timer = setTimeout(() => markAllAsRead(userId), 4000);
      return () => clearTimeout(timer);
    }
  }, [userId, tab]));

  useEffect(() => {
    const unsub = subscribeToNotifications(userId, (notifs) => {
      setNotifications(notifs);
      setLoading(false);
    });
    return () => unsub();
  }, [userId]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const navigateToEvent = useCallback(async (eventId, eventData) => {
    if (eventData?.title) {
      navigation.navigate('EventDetail', { event: { id: eventId, ...eventData } });
      return;
    }
    try {
      const snap = await getDoc(doc(db, 'events', eventId));
      if (snap.exists()) navigation.navigate('EventDetail', { event: { id: snap.id, ...snap.data() } });
    } catch {}
  }, [navigation]);

  const handlePress = useCallback(async (notif) => {
    if (!notif.read) await markAsRead(notif.id);
    switch (notif.type) {
      case NOTIFICATION_TYPES.LIKE:
      case NOTIFICATION_TYPES.COMMENT:
      case NOTIFICATION_TYPES.ATTEND:
      case NOTIFICATION_TYPES.NEW_EVENT:
        if (notif.eventId) { navigateToEvent(notif.eventId, notif.eventData); break; }
        navigation.navigate('UserProfile', { userId: notif.fromUserId });
        break;
      default:
        navigation.navigate('UserProfile', { userId: notif.fromUserId });
    }
  }, [navigation, navigateToEvent]);

  const handleDelete = useCallback(async (id) => {
    try { await deleteNotification(id); } catch { Alert.alert('Error', 'No se pudo eliminar la notificación'); }
  }, []);

  const handleAccept = useCallback(async (notif) => {
    try {
      const { fromUserId } = notif;
      await updateDoc(doc(db, 'users', userId), { followers: arrayUnion(fromUserId), followRequests: arrayRemove(fromUserId) });
      await updateDoc(doc(db, 'users', fromUserId), { following: arrayUnion(userId) });
      await createNotification({
        type: NOTIFICATION_TYPES.FOLLOW_ACCEPTED,
        fromUserId: userId,
        fromUserName: auth.currentUser.displayName || auth.currentUser.email.split('@')[0],
        fromUserAvatar: auth.currentUser.photoURL || '',
        toUserId: fromUserId,
        message: 'aceptó tu solicitud de seguimiento',
      });
      await deleteNotification(notif.id);
    } catch (e) { console.error(e); }
  }, [userId]);

  const handleReject = useCallback(async (notif) => {
    try {
      await updateDoc(doc(db, 'users', userId), { followRequests: arrayRemove(notif.fromUserId) });
      await deleteNotification(notif.id);
    } catch {}
  }, [userId]);

  const handleRequestNav = useCallback(async (item) => {
    if (!item.read) await markAsRead(item.id);
    navigation.navigate('UserProfile', { userId: item.fromUserId });
  }, [navigation]);

  // ── Datos derivados ────────────────────────────────────────────────────────

  const requests = notifications.filter(n => n.type === NOTIFICATION_TYPES.FOLLOW_REQUEST);
  const regular  = notifications.filter(n => n.type !== NOTIFICATION_TYPES.FOLLOW_REQUEST);
  const unread   = regular.filter(n => !n.read).length;

  // Agrupación por día: inyecta separadores en la lista plana
  const regularWithDays = useMemo(() => {
    const result = [];
    let lastDay = '';
    regular.forEach(n => {
      const ts = n.createdAt;
      if (!ts) { result.push(n); return; }
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      const today = new Date(); today.setHours(0,0,0,0);
      const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
      let label;
      if (d >= today) label = 'Hoy';
      else if (d >= yesterday) label = 'Ayer';
      else label = d.toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' });
      if (label !== lastDay) {
        result.push({ _isDaySep: true, id: `day_${label}`, label });
        lastDay = label;
      }
      result.push(n);
    });
    return result;
  }, [regular]);

  const renderNotif = useCallback(({ item }) => {
    if (item._isDaySep) {
      return (
        <View style={[styles.daySep, { borderBottomColor: colors['border.subtle'] }]}>
          <Text variant="overline" color="text.tertiary">{item.label.toUpperCase()}</Text>
        </View>
      );
    }
    return <NotificationItem item={item} onPress={handlePress} onDelete={handleDelete} colors={colors} />;
  }, [handlePress, handleDelete, colors]);

  const renderRequest = useCallback(({ item }) => (
    <FollowRequestItem item={item} onAccept={handleAccept} onReject={handleReject} onNavigate={handleRequestNav} colors={colors} />
  ), [handleAccept, handleReject, handleRequestNav, colors]);

  const LIST_PROPS = { showsVerticalScrollIndicator: false, estimatedItemSize: 72 };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="h2">{t.alerts.title}</Text>
        {unread > 0 && tab === 'notificaciones' && (
          <Pressable onPress={() => markAllAsRead(userId)} accessibilityRole="button">
            <Text variant="label" color="nav.selected">{t.alerts.markAll}</Text>
          </Pressable>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabsWrap}>
        <UnderlineTabs
          options={TABS.map(x => ({
            ...x,
            label: x.value === 'solicitudes' && requests.length > 0
              ? `${x.label} (${requests.length})`
              : x.label,
          }))}
          selected={tab}
          onSelect={setTab}
        />
      </View>

      {/* Contenido */}
      {loading ? (
        <SkeletonList count={5} />
      ) : tab === 'notificaciones' ? (
        regular.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="notifications-outline" size={28} color={colors['text.tertiary']} />}
            title="Todavía no hay nada"
            description="Seguí a un organizador o guardá un evento y acá te avisamos de todo lo que pase."
            actionLabel="Explorar eventos"
            onAction={() => navigation.navigate('Home')}
          />
        ) : (
          <FlashList data={regularWithDays} keyExtractor={i => i.id} renderItem={renderNotif} {...LIST_PROPS} />
        )
      ) : (
        requests.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="person-add-outline" size={28} color={colors['text.tertiary']} />}
            title="Sin solicitudes"
            description="Las solicitudes de seguimiento aparecen acá."
          />
        ) : (
          <FlashList data={requests} keyExtractor={i => i.id} renderItem={renderRequest} {...LIST_PROPS} />
        )
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space[5], paddingVertical: space[4] },
  tabsWrap: { paddingHorizontal: space[5] },
  daySep: {
    paddingHorizontal: space[5],
    paddingTop: space[4],
    paddingBottom: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: space[3],
    minHeight: 72,
  },
  avatarWrap: { position: 'relative' },
  iconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  notifContent: { flex: 1 },
  unreadDot: { width: 10, height: 10, borderRadius: 5 },
  swipeDelete: {
    width: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },

  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: space[3],
    minHeight: 80,
  },
  requestUser: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[3] },
  requestInfo: { flex: 1 },
  requestBtns: { flexDirection: 'row', gap: space[2] },
});

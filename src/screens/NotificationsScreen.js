// NotificationsScreen — Notificaciones · Mensajes · Solicitudes
// Los mensajes volvieron acá como pestaña (antes eran una pantalla aparte,
// MessagesScreen, con acceso desde el header de Inicio).
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

import ChatList, { filterVisibleChats, goToCreateGroup } from '../components/ChatList';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/Skeleton';
import Text from '../components/ui/Text';
import { UnderlineTabs } from '../components/ui/SegmentedControl';

import { auth, db } from '../config/firebase';
import useBlockedUsers from '../hooks/useBlockedUsers';
import { subscribeToChats } from '../services/chatService';
import { createNotification, deleteNotification, markAllAsRead, markAsRead, NOTIFICATION_TYPES, subscribeToNotifications } from '../services/notificationService';
import { toDate } from '../lib/format';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { useTranslation } from 'react-i18next';
import i18n, { intlLocale } from '../i18n';

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

// El texto de la notificación se arma según el tipo, en el idioma de quien
// la LEE. El campo message que se guarda en Firestore queda en el idioma de
// quien la generó, así que solo se usa para tipos sin plantilla (p. ej. el
// aviso de moderación, que trae el motivo que escribió el admin).
function notifText(item) {
  if (item.type === NOTIFICATION_TYPES.NEW_EVENT) {
    const title = item.eventData?.title;
    return title ? i18n.t('alerts.types.new_event', { title }) : i18n.t('alerts.types.new_event_untitled');
  }
  if (item.type && i18n.exists(`alerts.types.${item.type}`)) return i18n.t(`alerts.types.${item.type}`);
  return item.message;
}

function formatRelTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - toDate(dateStr);
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return i18n.t('alerts.now');
  if (m < 60) return `${m}m`;
  if (h < 24) return `${h}h`;
  if (d < 7)  return `${d}d`;
  return toDate(dateStr).toLocaleDateString(intlLocale());
}

// ─── NotificationItem ─────────────────────────────────────────────────────────

const NotificationItem = memo(function NotificationItem({ item, onPress, onDelete, colors }) {
  const { t } = useTranslation();
  const swipeRef = useRef(null);
  const icon = getNotifIcon(item.type, colors);

  const renderRight = (progress, dragX) => {
    const scale = dragX.interpolate({ inputRange: [-72, 0], outputRange: [1, 0], extrapolate: 'clamp' });
    return (
      <Pressable
        style={[styles.swipeDelete, { backgroundColor: colors['status.urgent'] }]}
        onPress={() => { swipeRef.current?.close(); onDelete(item.id); }}
        accessibilityLabel={t('alerts.deleteNotif')}
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
            {notifText(item)}
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
  const { t } = useTranslation();
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
          <Text variant="caption" color="text.tertiary">{t('alerts.wantsToFollow')}</Text>
        </View>
      </Pressable>
      {processing ? (
        <ActivityIndicator color={colors['action.primary']} />
      ) : (
        <View style={styles.requestBtns}>
          <Button variant="primary" size="sm" label={t('alerts.accept')} onPress={() => handle(onAccept)} />
          <Button variant="secondary" size="sm" label={t('alerts.reject')} onPress={() => handle(onReject)} />
        </View>
      )}
    </View>
  );
});

// ─── NotificationsScreen ──────────────────────────────────────────────────────

const TABS = [
  { labelKey: 'alerts.tabs.notifications', value: 'notificaciones' },
  { labelKey: 'alerts.tabs.messages',      value: 'mensajes' },
  { labelKey: 'alerts.tabs.requests',      value: 'solicitudes' },
];

export default function NotificationsScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { t, i18n: i18nInstance } = useTranslation();
  const [tab, setTab] = useState(route?.params?.tab ?? 'notificaciones');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const userId = auth.currentUser?.uid;
  const { allBlocked } = useBlockedUsers();

  // Otras pantallas pueden mandar a una pestaña concreta, p. ej. GroupInfo
  // al salir de un grupo: navigate('Notifications', { tab: 'mensajes' }).
  useEffect(() => {
    if (route?.params?.tab) setTab(route.params.tab);
  }, [route?.params?.tab]);

  useEffect(() => {
    if (!userId) { setChatsLoading(false); return; }
    const unsub = subscribeToChats(userId, (data) => {
      setChats(data);
      setChatsLoading(false);
    });
    return () => unsub();
  }, [userId]);

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
    try { await deleteNotification(id); } catch { Alert.alert(t('common.error'), t('alerts.deleteError')); }
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
  const unreadChats = useMemo(
    () => filterVisibleChats(chats, userId, allBlocked).filter(c => c.unreadFor?.includes(userId)).length,
    [chats, userId, allBlocked]
  );

  // Agrupación por día: inyecta separadores en la lista plana
  const regularWithDays = useMemo(() => {
    const result = [];
    let lastDay = '';
    regular.forEach(n => {
      const ts = n.createdAt;
      if (!ts) { result.push(n); return; }
      const d = toDate(ts);
      const today = new Date(); today.setHours(0,0,0,0);
      const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
      let label;
      if (d >= today) label = t('common.today');
      else if (d >= yesterday) label = t('common.yesterday');
      else label = d.toLocaleDateString(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
      if (label !== lastDay) {
        result.push({ _isDaySep: true, id: `day_${label}`, label });
        lastDay = label;
      }
      result.push(n);
    });
    return result;
  }, [regular, i18nInstance.language]);

  const renderNotif = useCallback(({ item }) => {
    if (item._isDaySep) {
      return (
        <View style={[styles.daySep, { borderBottomColor: colors['border.subtle'] }]}>
          <Text variant="overline" color="text.tertiary">{item.label.toUpperCase()}</Text>
        </View>
      );
    }
    return <NotificationItem item={item} onPress={handlePress} onDelete={handleDelete} colors={colors} />;
  }, [handlePress, handleDelete, colors, i18nInstance.language]);

  const renderRequest = useCallback(({ item }) => (
    <FollowRequestItem item={item} onAccept={handleAccept} onReject={handleReject} onNavigate={handleRequestNav} colors={colors} />
  ), [handleAccept, handleReject, handleRequestNav, colors]);

  // paddingBottom: igual que en el resto de las pantallas con tab bar, para que
  // el último ítem no quede al ras del borde de la barra.
  const LIST_PROPS = {
    showsVerticalScrollIndicator: false,
    estimatedItemSize: 72,
    contentContainerStyle: { paddingBottom: space[6] },
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="h2">{t('alerts.title')}</Text>
        {unread > 0 && tab === 'notificaciones' && (
          <Pressable onPress={() => markAllAsRead(userId)} accessibilityRole="button">
            <Text variant="label" color="nav.selected">{t('alerts.markAll')}</Text>
          </Pressable>
        )}
        {tab === 'mensajes' && (
          <Pressable
            onPress={() => goToCreateGroup(navigation)}
            style={styles.headerIcon}
            accessibilityRole="button"
            accessibilityLabel={t('alerts.createGroup')}
          >
            <Ionicons name="people-outline" size={24} color={colors['text.primary']} />
          </Pressable>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabsWrap}>
        <UnderlineTabs
          options={TABS.map(x => ({
            ...x,
            label: x.value === 'solicitudes' && requests.length > 0
              ? t('alerts.tabCount', { label: t(x.labelKey), count: requests.length })
              : x.value === 'mensajes' && unreadChats > 0
                ? t('alerts.tabCount', { label: t(x.labelKey), count: unreadChats })
                : t(x.labelKey),
          }))}
          selected={tab}
          onSelect={setTab}
        />
      </View>

      {/* Contenido */}
      {tab === 'mensajes' ? (
        <ChatList
          chats={chats}
          loading={chatsLoading}
          navigation={navigation}
          contentContainerStyle={LIST_PROPS.contentContainerStyle}
        />
      ) : loading ? (
        <SkeletonList count={5} />
      ) : tab === 'notificaciones' ? (
        regular.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="notifications-outline" size={28} color={colors['text.tertiary']} />}
            title={t('alerts.empty.title')}
            description={t('alerts.empty.desc')}
            actionLabel={t('alerts.empty.action')}
            onAction={() => navigation.navigate('Home')}
          />
        ) : (
          <FlashList data={regularWithDays} keyExtractor={i => i.id} renderItem={renderNotif} {...LIST_PROPS} />
        )
      ) : (
        requests.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="person-add-outline" size={28} color={colors['text.tertiary']} />}
            title={t('alerts.noRequestsTitle')}
            description={t('alerts.noRequestsDesc')}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space[5], paddingVertical: space[4], minHeight: 76 },
  headerIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginVertical: -space[2] },
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

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { arrayRemove, arrayUnion, doc, getDoc, updateDoc } from 'firebase/firestore';
import { memo, useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebase';
import { subscribeToChats } from '../services/chatService';
import { createNotification, deleteNotification, markAllAsRead, markAsRead, NOTIFICATION_TYPES, subscribeToNotifications } from '../services/notificationService';

// --- Funciones puras de módulo (no se recrean en cada render) ---

function getNotificationIcon(type) {
  switch (type) {
    case NOTIFICATION_TYPES.LIKE:            return { name: 'heart', color: '#e74c3c' };
    case NOTIFICATION_TYPES.COMMENT:         return { name: 'chatbubble', color: '#0984e3' };
    case NOTIFICATION_TYPES.FOLLOW:          return { name: 'person-add', color: '#6c5ce7' };
    case NOTIFICATION_TYPES.FOLLOW_REQUEST:  return { name: 'person-add-outline', color: '#fdcb6e' };
    case NOTIFICATION_TYPES.FOLLOW_ACCEPTED: return { name: 'checkmark-circle', color: '#00b894' };
    case NOTIFICATION_TYPES.ATTEND:          return { name: 'calendar', color: '#00b894' };
    default:                                 return { name: 'notifications', color: '#888' };
  }
}

function formatTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours   = Math.floor(diff / 3600000);
  const days    = Math.floor(diff / 86400000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24)   return `${hours}h`;
  if (days < 7)     return `${days}d`;
  return date.toLocaleDateString();
}

// --- Componentes extraídos (antes vivían dentro de NotificationsScreen) ---
// Extraerlos elimina el problema de re-creación en cada render del padre.

const NotificationItem = memo(function NotificationItem({ item, onPress }) {
  const [avatar, setAvatar] = useState(item.fromUserAvatar || '');
  const icon = getNotificationIcon(item.type);

  useEffect(() => {
    if (!item.fromUserId) return;
    let mounted = true;
    getDoc(doc(db, 'users', item.fromUserId))
      .then(userDoc => {
        if (mounted && userDoc.exists()) {
          const a = userDoc.data().avatar;
          if (a) setAvatar(a);
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [item.fromUserId]);

  return (
    <TouchableOpacity
      style={[styles.notificationItem, !item.read && styles.unreadItem]}
      onPress={() => onPress(item)}
    >
      <View style={styles.avatarContainer}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={20} color="#888" />
          </View>
        )}
        <View style={[styles.iconBadge, { backgroundColor: icon.color }]}>
          <Ionicons name={icon.name} size={12} color="#fff" />
        </View>
      </View>
      <View style={styles.notificationContent}>
        <Text style={styles.notificationText}>
          <Text style={styles.userName}>{item.fromUserName}</Text> {item.message}
        </Text>
        <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
      </View>
      {!item.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
});

const FollowRequestItem = memo(function FollowRequestItem({ item, onAccept, onReject, onNavigate }) {
  const [avatar, setAvatar] = useState(item.fromUserAvatar || '');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!item.fromUserId) return;
    let mounted = true;
    getDoc(doc(db, 'users', item.fromUserId))
      .then(userDoc => {
        if (mounted && userDoc.exists()) {
          const a = userDoc.data().avatar;
          if (a) setAvatar(a);
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [item.fromUserId]);

  const handleAccept = async () => {
    setProcessing(true);
    await onAccept(item);
    setProcessing(false);
  };

  const handleReject = async () => {
    setProcessing(true);
    await onReject(item);
    setProcessing(false);
  };

  return (
    <View style={styles.requestItem}>
      <TouchableOpacity style={styles.requestUser} onPress={() => onNavigate(item)}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.requestAvatar} />
        ) : (
          <View style={[styles.requestAvatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={20} color="#888" />
          </View>
        )}
        <View style={styles.requestContent}>
          <Text style={styles.requestName}>{item.fromUserName}</Text>
          <Text style={styles.requestText}>Quiere seguirte</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.requestButtons}>
        {processing ? (
          <ActivityIndicator color="#6c5ce7" />
        ) : (
          <>
            <TouchableOpacity style={styles.acceptButton} onPress={handleAccept}>
              <Ionicons name="checkmark" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectButton} onPress={handleReject}>
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
});

const ChatItem = memo(function ChatItem({ item, otherUser, onPress }) {
  return (
    <TouchableOpacity style={styles.chatItem} onPress={() => onPress(item)}>
      {otherUser?.avatar ? (
        <Image source={{ uri: otherUser.avatar }} style={styles.chatAvatar} />
      ) : (
        <View style={[styles.chatAvatar, styles.avatarPlaceholder]}>
          <Ionicons name="person" size={24} color="#888" />
        </View>
      )}
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatUserName}>{otherUser?.name || 'Usuario'}</Text>
          <Text style={styles.chatTime}>{formatTime(item.lastMessageTime)}</Text>
        </View>
        <Text style={styles.chatLastMessage} numberOfLines={1}>
          {item.lastMessage || 'Inicia una conversacion'}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

// --- Pantalla principal ---

export default function NotificationsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('notificaciones');
  const [notifications, setNotifications] = useState([]);
  const [chats, setChats] = useState([]);
  const [usersData, setUsersData] = useState({});
  const [loading, setLoading] = useState(true);

  const userId = auth.currentUser?.uid;

  useFocusEffect(
    useCallback(() => {
      if (userId && activeTab === 'notificaciones') {
        const timer = setTimeout(() => markAllAsRead(userId), 4000);
        return () => clearTimeout(timer);
      }
    }, [userId, activeTab])
  );

  useEffect(() => {
    const unsubNotifications = subscribeToNotifications(userId, (newNotifications) => {
      setNotifications(newNotifications);
      setLoading(false);
    });

    const unsubChats = subscribeToChats(userId, async (newChats) => {
      setChats(newChats);
      // Promise.all: carga todos los participantes en paralelo
      const otherUserIds = [...new Set(
        newChats
          .map(chat => chat.participants.find(id => id !== userId))
          .filter(Boolean)
      )];
      const userDocs = await Promise.all(
        otherUserIds.map(uid => getDoc(doc(db, 'users', uid)).catch(() => null))
      );
      const newUsersData = {};
      otherUserIds.forEach((uid, i) => {
        if (userDocs[i]?.exists()) newUsersData[uid] = userDocs[i].data();
      });
      if (Object.keys(newUsersData).length > 0) {
        setUsersData(prev => ({ ...prev, ...newUsersData }));
      }
    });

    return () => {
      unsubNotifications();
      unsubChats();
    };
  }, [userId]);

  const handleNotificationPress = useCallback(async (notification) => {
    if (!notification.read) await markAsRead(notification.id);
    switch (notification.type) {
      case NOTIFICATION_TYPES.LIKE:
      case NOTIFICATION_TYPES.COMMENT:
      case NOTIFICATION_TYPES.ATTEND:
        if (notification.eventId) {
          navigation.navigate('EventDetail', { event: { id: notification.eventId, ...notification.eventData } });
        }
        break;
      case NOTIFICATION_TYPES.FOLLOW:
      case NOTIFICATION_TYPES.FOLLOW_REQUEST:
      case NOTIFICATION_TYPES.FOLLOW_ACCEPTED:
        navigation.navigate('UserProfile', { userId: notification.fromUserId });
        break;
    }
  }, [navigation]);

  const handleAcceptRequest = useCallback(async (notification) => {
    try {
      const fromUserId = notification.fromUserId;
      await updateDoc(doc(db, 'users', userId), {
        followers: arrayUnion(fromUserId),
        followRequests: arrayRemove(fromUserId),
      });
      await updateDoc(doc(db, 'users', fromUserId), {
        following: arrayUnion(userId),
      });
      await createNotification({
        type: NOTIFICATION_TYPES.FOLLOW_ACCEPTED,
        fromUserId: userId,
        fromUserName: auth.currentUser.displayName || auth.currentUser.email.split('@')[0],
        fromUserAvatar: auth.currentUser.photoURL || '',
        toUserId: fromUserId,
        message: 'acepto tu solicitud de seguimiento',
      });
      await deleteNotification(notification.id);
      Alert.alert('Aceptado', `Ahora ${notification.fromUserName} te sigue`);
    } catch (error) {
      console.error('Error aceptando solicitud:', error);
      Alert.alert('Error', 'No se pudo aceptar la solicitud');
    }
  }, [userId]);

  const handleRejectRequest = useCallback(async (notification) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        followRequests: arrayRemove(notification.fromUserId),
      });
      await deleteNotification(notification.id);
      Alert.alert('Rechazado', 'Solicitud rechazada');
    } catch (error) {
      console.error('Error rechazando solicitud:', error);
      Alert.alert('Error', 'No se pudo rechazar la solicitud');
    }
  }, [userId]);

  const handleRequestNavigate = useCallback(async (item) => {
    if (!item.read) await markAsRead(item.id);
    navigation.navigate('UserProfile', { userId: item.fromUserId });
  }, [navigation]);

  const handleMarkAllRead = useCallback(async () => {
    await markAllAsRead(userId);
  }, [userId]);

  const handleChatPress = useCallback((chat) => {
    const otherUserId = chat.participants.find(id => id !== userId);
    const otherUser = usersData[otherUserId];
    navigation.navigate('ChatDetail', {
      chatId: chat.id,
      otherUserId,
      otherUserName: otherUser?.name || 'Usuario',
      otherUserAvatar: otherUser?.avatar || '',
    });
  }, [userId, usersData, navigation]);

  const handleNotificationsTabPress = useCallback(() => {
    setActiveTab('notificaciones');
    if (userId) setTimeout(() => markAllAsRead(userId), 4000);
  }, [userId]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const followRequests = notifications.filter(n => n.type === NOTIFICATION_TYPES.FOLLOW_REQUEST);
  const regularNotifications = notifications.filter(n => n.type !== NOTIFICATION_TYPES.FOLLOW_REQUEST);

  const renderNotification = useCallback(({ item }) => (
    <NotificationItem item={item} onPress={handleNotificationPress} />
  ), [handleNotificationPress]);

  const renderFollowRequest = useCallback(({ item }) => (
    <FollowRequestItem
      item={item}
      onAccept={handleAcceptRequest}
      onReject={handleRejectRequest}
      onNavigate={handleRequestNavigate}
    />
  ), [handleAcceptRequest, handleRejectRequest, handleRequestNavigate]);

  const renderChat = useCallback(({ item }) => {
    const otherUserId = item.participants.find(id => id !== userId);
    return <ChatItem item={item} otherUser={usersData[otherUserId]} onPress={handleChatPress} />;
  }, [userId, usersData, handleChatPress]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6c5ce7" />
      </View>
    );
  }

  const FLASHLIST_PROPS = {
    showsVerticalScrollIndicator: false,
    estimatedItemSize: 70,
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Actividad</Text>
        {unreadCount > 0 && activeTab === 'notificaciones' && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllRead}>Marcar todo leido</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'notificaciones' && styles.tabActive]}
          onPress={handleNotificationsTabPress}
        >
          <Ionicons name="notifications" size={20} color={activeTab === 'notificaciones' ? '#6c5ce7' : '#888'} />
          <Text style={[styles.tabText, activeTab === 'notificaciones' && styles.tabTextActive]}>Notificaciones</Text>
          {unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount}</Text></View>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'solicitudes' && styles.tabActive]}
          onPress={() => setActiveTab('solicitudes')}
        >
          <Ionicons name="person-add" size={20} color={activeTab === 'solicitudes' ? '#6c5ce7' : '#888'} />
          <Text style={[styles.tabText, activeTab === 'solicitudes' && styles.tabTextActive]}>Solicitudes</Text>
          {followRequests.length > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{followRequests.length}</Text></View>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'mensajes' && styles.tabActive]}
          onPress={() => setActiveTab('mensajes')}
        >
          <Ionicons name="chatbubbles" size={20} color={activeTab === 'mensajes' ? '#6c5ce7' : '#888'} />
          <Text style={[styles.tabText, activeTab === 'mensajes' && styles.tabTextActive]}>Mensajes</Text>
          {chats.length > 0 && <View style={styles.badgeGreen}><Text style={styles.badgeText}>{chats.length}</Text></View>}
        </TouchableOpacity>
      </View>

      {activeTab === 'notificaciones' && (
        regularNotifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-outline" size={60} color="#888" />
            <Text style={styles.emptyTitle}>Sin notificaciones</Text>
            <Text style={styles.emptyText}>Cuando alguien interactue contigo aparecera aqui</Text>
          </View>
        ) : (
          <FlashList
            data={regularNotifications}
            keyExtractor={(item) => item.id}
            renderItem={renderNotification}
            {...FLASHLIST_PROPS}
          />
        )
      )}

      {activeTab === 'solicitudes' && (
        followRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="person-add-outline" size={60} color="#888" />
            <Text style={styles.emptyTitle}>Sin solicitudes</Text>
            <Text style={styles.emptyText}>Las solicitudes de seguimiento apareceran aqui</Text>
          </View>
        ) : (
          <FlashList
            data={followRequests}
            keyExtractor={(item) => item.id}
            renderItem={renderFollowRequest}
            {...FLASHLIST_PROPS}
          />
        )
      )}

      {activeTab === 'mensajes' && (
        chats.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={60} color="#888" />
            <Text style={styles.emptyTitle}>Sin mensajes</Text>
            <Text style={styles.emptyText}>Tus conversaciones apareceran aqui</Text>
          </View>
        ) : (
          <FlashList
            data={chats}
            keyExtractor={(item) => item.id}
            renderItem={renderChat}
            {...FLASHLIST_PROPS}
          />
        )
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#1a1a2e'},
  loadingContainer: {flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center'},
  header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 15, paddingBottom: 15},
  headerTitle: {fontSize: 24, fontWeight: 'bold', color: '#fff'},
  markAllRead: {color: '#6c5ce7', fontSize: 14, fontWeight: '600'},
  tabsContainer: {flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#2d2d44'},
  tab: {flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12},
  tabActive: {borderBottomWidth: 2, borderBottomColor: '#6c5ce7'},
  tabText: {color: '#888', fontSize: 12, fontWeight: '600', marginLeft: 5},
  tabTextActive: {color: '#fff'},
  badge: {backgroundColor: '#e74c3c', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', marginLeft: 5},
  badgeGreen: {backgroundColor: '#00b894', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', marginLeft: 5},
  badgeText: {color: '#fff', fontSize: 10, fontWeight: 'bold'},
  notificationItem: {flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#2d2d44'},
  unreadItem: {backgroundColor: 'rgba(108, 92, 231, 0.1)'},
  avatarContainer: {position: 'relative'},
  avatar: {width: 50, height: 50, borderRadius: 25, backgroundColor: '#2d2d44'},
  avatarPlaceholder: {justifyContent: 'center', alignItems: 'center'},
  iconBadge: {position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#1a1a2e'},
  notificationContent: {flex: 1, marginLeft: 12},
  notificationText: {color: '#fff', fontSize: 14, lineHeight: 20},
  userName: {fontWeight: 'bold'},
  timeText: {color: '#888', fontSize: 12, marginTop: 4},
  unreadDot: {width: 10, height: 10, borderRadius: 5, backgroundColor: '#6c5ce7'},
  requestItem: {flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#2d2d44'},
  requestUser: {flexDirection: 'row', alignItems: 'center', flex: 1},
  requestAvatar: {width: 50, height: 50, borderRadius: 25, backgroundColor: '#2d2d44'},
  requestContent: {marginLeft: 12, flex: 1},
  requestName: {color: '#fff', fontSize: 15, fontWeight: '600'},
  requestText: {color: '#888', fontSize: 13, marginTop: 2},
  requestButtons: {flexDirection: 'row'},
  acceptButton: {backgroundColor: '#6c5ce7', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 8},
  rejectButton: {backgroundColor: '#2d2d44', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center'},
  chatItem: {flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#2d2d44'},
  chatAvatar: {width: 55, height: 55, borderRadius: 28, backgroundColor: '#2d2d44'},
  chatContent: {flex: 1, marginLeft: 15},
  chatHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4},
  chatUserName: {fontSize: 16, fontWeight: '600', color: '#fff'},
  chatTime: {fontSize: 12, color: '#888'},
  chatLastMessage: {fontSize: 14, color: '#888'},
  emptyState: {flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40},
  emptyTitle: {color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 15},
  emptyText: {color: '#888', fontSize: 14, textAlign: 'center', marginTop: 8},
});

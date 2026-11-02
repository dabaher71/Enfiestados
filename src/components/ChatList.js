// ChatList — lista de conversaciones (directos y grupos).
// Vive en la pestaña "Mensajes" de NotificationsScreen (antes era una pantalla
// propia, MessagesScreen, a la que se entraba desde el header de Inicio).
//
// FIX_ROUND_4 § F (Chat): los documentos de chat solo guardan participants/
// lastMessage/lastMessageTime — nunca otherUserName/otherUserAvatar (no
// pueden ser un campo fijo del doc: "el otro usuario" depende de quién mira).
// Se resuelve el otro participante con un getDoc por chat.
//
// La suscripción a los chats la hace el padre (para poder mostrar el contador
// de no leídos en la pestaña aunque esta lista no esté montada).
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import Avatar from './ui/Avatar';
import EmptyState from './ui/EmptyState';
import { SkeletonList } from './ui/Skeleton';
import Text from './ui/Text';

import { auth, db } from '../config/firebase';
import useBlockedUsers from '../hooks/useBlockedUsers';
import { requireAccount } from '../lib/requireAccount';
import { isGroupChat } from '../services/chatService';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

// Tiempo relativo humano: "hace 2 h", "ayer", "lun 21 jul"
function chatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  const h = diff / 3600000;
  const days = diff / 86400000;
  if (h < 1) return i18n.t('alerts.now');
  if (h < 24) return `${Math.floor(h)} h`;
  if (days < 2) return i18n.t('common.yesterday');
  const DAYS = i18n.t('format.daysShort', { returnObjects: true });
  const MONTHS = i18n.t('format.monthsShort', { returnObjects: true });
  if (days < 7) return DAYS[d.getDay()];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// Chats que se muestran: un grupo no se oculta por tener dentro a alguien
// bloqueado (lo que se filtra son sus mensajes, dentro del chat); un directo
// con alguien bloqueado, en cualquier sentido, sí.
export function filterVisibleChats(chats, userId, allBlocked) {
  return chats.filter(c => {
    if (isGroupChat(c)) return true;
    const otherId = c.participants?.find(id => id !== userId);
    return !allBlocked.has(otherId);
  });
}

export const goToCreateGroup = (navigation) => {
  if (!requireAccount(navigation, i18n.t('messages.needAccountGroup'))) return;
  navigation.navigate('CreateGroup');
};

export default function ChatList({ chats, loading, navigation, contentContainerStyle }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [usersData, setUsersData] = useState({});
  const userId = auth.currentUser?.uid;
  const { allBlocked } = useBlockedUsers();
  const requestedRef = useRef(new Set()); // perfiles ya pedidos, para no repetir

  // Solo los directos necesitan resolver al otro participante; un grupo ya
  // trae su propio nombre en el doc.
  useEffect(() => {
    const ids = [...new Set(
      chats.filter(c => !isGroupChat(c))
        .map(c => c.participants?.find(id => id !== userId))
        .filter(id => id && !requestedRef.current.has(id))
    )];
    if (ids.length === 0) return;
    ids.forEach(id => requestedRef.current.add(id));
    Promise.all(ids.map(uid => getDoc(doc(db, 'users', uid)).catch(() => null)))
      .then(docs => {
        const map = {};
        ids.forEach((uid, i) => { if (docs[i]?.exists()) map[uid] = docs[i].data(); });
        if (Object.keys(map).length > 0) setUsersData(prev => ({ ...prev, ...map }));
      });
  }, [chats, userId]);

  const renderItem = useCallback(({ item }) => {
    const group    = isGroupChat(item);
    const otherId  = group ? null : item.participants?.find(id => id !== userId);
    const other    = otherId ? usersData[otherId] : null;
    const isUnread = item.unreadFor?.includes(userId);

    const title  = group ? (item.name || t('chat.group')) : (other?.name ?? t('profile.user'));
    const avatar = group ? null : other?.avatar;

    return (
      <Pressable
        style={[styles.chatRow, { borderBottomColor: colors['border.subtle'] }]}
        onPress={() => navigation.navigate('ChatDetail', {
          chatId: item.id,
          isGroup: group,
          otherUserId: otherId,
          otherUserName: other?.name ?? '',
          otherUserAvatar: other?.avatar ?? '',
        })}
      >
        <Avatar uri={avatar} name={title} size={48} />
        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text variant="title" numberOfLines={1} style={{ flex: 1 }}>{title}</Text>
            {item.lastMessageTime && (
              <Text variant="caption" color="text.tertiary">
                {chatTime(item.lastMessageTime)}
              </Text>
            )}
          </View>
          <Text variant="caption" color={isUnread ? 'text.primary' : 'text.tertiary'} numberOfLines={1}>
            {group
              ? t('messages.groupPreview', { count: item.participants?.length ?? 0, last: item.lastMessage || t('messages.noMessages') })
              : (item.lastMessage || t('messages.noMessages'))}
          </Text>
        </View>
        {isUnread && (
          <View style={[styles.unreadDot, { backgroundColor: colors['action.primary'] }]} />
        )}
      </Pressable>
    );
  }, [userId, usersData, colors, navigation, t]);

  const visibleChats = useMemo(
    () => filterVisibleChats(chats, userId, allBlocked),
    [chats, userId, allBlocked]
  );

  if (loading) return <SkeletonList count={5} />;

  if (visibleChats.length === 0) {
    return (
      <EmptyState
        icon={<Ionicons name="chatbubbles-outline" size={28} color={colors['text.tertiary']} />}
        title={t('messages.empty.title')}
        description={t('messages.emptyDesc')}
        actionLabel={t('messages.createGroup')}
        onAction={() => goToCreateGroup(navigation)}
      />
    );
  }

  return (
    <FlatList
      data={visibleChats}
      keyExtractor={item => item.id}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={contentContainerStyle}
    />
  );
}

const styles = StyleSheet.create({
  chatRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[5], paddingVertical: space[3], gap: space[3], borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 72 },
  chatContent: { flex: 1, gap: 4 },
  chatHeader:  { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  unreadDot:   { width: 10, height: 10, borderRadius: 5 },
});

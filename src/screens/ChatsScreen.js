// ChatsScreen — lista de conversaciones, tokens completos
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { subscribeToChats } from '../services/chatService';

import Avatar from '../components/ui/Avatar';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/Skeleton';
import Text from '../components/ui/Text';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';

function chatTime(ts) {
  if (!ts) return '';
  const d   = new Date(ts);
  const now = new Date();
  const diff = now - d;
  const h = diff / 3600000;
  const days = diff / 86400000;
  const DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  if (h < 1)   return 'Ahora';
  if (h < 24)  return `${Math.floor(h)} h`;
  if (days < 2) return 'Ayer';
  if (days < 7) return DAYS[d.getDay()];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export default function ChatsScreen({ navigation }) {
  const { colors } = useTheme();
  const [chats,    setChats]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [usersData,setUsersData]= useState({});

  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    const unsub = subscribeToChats(currentUserId, async (newChats) => {
      setChats(newChats);
      const ids = [...new Set(newChats.map(c => c.participants.find(id => id !== currentUserId)).filter(Boolean))];
      const docs = await Promise.all(ids.map(uid => getDoc(doc(db, 'users', uid)).catch(() => null)));
      const map = {};
      ids.forEach((uid, i) => { if (docs[i]?.exists()) map[uid] = docs[i].data(); });
      if (Object.keys(map).length > 0) setUsersData(prev => ({ ...prev, ...map }));
      setLoading(false);
    });
    return () => unsub();
  }, [currentUserId]);

  const handlePress = useCallback((chat) => {
    const otherId = chat.participants.find(id => id !== currentUserId);
    const other   = usersData[otherId];
    navigation.navigate('ChatDetail', {
      chatId: chat.id, otherUserId: otherId,
      otherUserName: other?.name || 'Usuario',
      otherUserAvatar: other?.avatar || '',
    });
  }, [currentUserId, usersData, navigation]);

  const renderItem = useCallback(({ item }) => {
    const otherId   = item.participants.find(id => id !== currentUserId);
    const other     = usersData[otherId];
    const isUnread  = item.unreadFor?.includes(currentUserId);
    return (
      <Pressable
        style={[styles.row, { borderBottomColor: colors['border.subtle'] }]}
        onPress={() => handlePress(item)}
        accessibilityRole="button"
      >
        <Avatar uri={other?.avatar} name={other?.name} size={48} />
        <View style={styles.content}>
          <View style={styles.rowHeader}>
            <Text variant="title" numberOfLines={1} style={{ flex: 1 }}>{other?.name || 'Usuario'}</Text>
            <Text variant="caption" color="text.tertiary">{chatTime(item.lastMessageTime)}</Text>
          </View>
          <Text
            variant="caption"
            style={{ color: isUnread ? colors['text.primary'] : colors['text.tertiary'] }}
            numberOfLines={1}
          >
            {item.lastMessage || 'Sin mensajes'}
          </Text>
        </View>
        {isUnread && (
          <View style={[styles.unreadDot, { backgroundColor: colors['action.primary'] }]} />
        )}
      </Pressable>
    );
  }, [currentUserId, usersData, handlePress, colors]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      <View style={[styles.header, { borderBottomColor: colors['border.subtle'] }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={colors['text.primary']} />
        </Pressable>
        <Text variant="h2">Mensajes</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <SkeletonList count={5} />
      ) : chats.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="chatbubbles-outline" size={28} color={colors['text.tertiary']} />}
          title="Sin conversaciones"
          description="Cuando compartás un evento con alguien, la charla aparece acá."
          actionLabel="Explorar eventos"
          onAction={() => navigation.navigate('Home')}
        />
      ) : (
        <FlashList
          data={chats}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          estimatedItemSize={72}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[5], paddingVertical: space[4], borderBottomWidth: StyleSheet.hairlineWidth, gap: space[3] },
  back:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  row:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[5], paddingVertical: space[3], borderBottomWidth: StyleSheet.hairlineWidth, gap: space[3], minHeight: 72 },
  content:   { flex: 1, gap: 4 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  unreadDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
});

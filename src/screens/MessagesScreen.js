// MessagesScreen — pantalla propia para chats, accesible desde header de Inicio
// Reutiliza la lógica existente de ChatsScreen pero con estructura del design system
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, Text as RNText } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../config/firebase';
import Avatar from '../components/ui/Avatar';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/Skeleton';
import Text from '../components/ui/Text';
import { subscribeToChats } from '../services/chatService';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';

// Tiempo relativo humano: "hace 2 h", "ayer", "lun 21 jul"
function chatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  const h = diff / 3600000;
  const days = diff / 86400000;
  if (h < 1) return 'Ahora';
  if (h < 24) return `${Math.floor(h)} h`;
  if (days < 2) return 'Ayer';
  const DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  if (days < 7) return DAYS[d.getDay()];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export default function MessagesScreen({ navigation }) {
  const { colors } = useTheme();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    const unsub = subscribeToChats(userId, (data) => {
      setChats(data);
      setLoading(false);
    });
    return () => unsub();
  }, [userId]);

  const renderItem = useCallback(({ item }) => {
    const otherId = item.participants?.find(id => id !== userId);
    const isUnread = item.unreadFor?.includes(userId);
    return (
      <Pressable
        style={[styles.chatRow, { borderBottomColor: colors['border.subtle'] }]}
        onPress={() => navigation.navigate('ChatDetail', {
          chatId: item.id,
          otherUserId: otherId,
          otherUserName: item.otherUserName ?? '',
          otherUserAvatar: item.otherUserAvatar ?? '',
        })}
      >
        <Avatar name={item.otherUserName} size={48} />
        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text variant="title" numberOfLines={1} style={{ flex: 1 }}>{item.otherUserName ?? 'Usuario'}</Text>
            {item.lastMessageTime && (
              <Text variant="caption" color="text.tertiary">
                {chatTime(item.lastMessageTime)}
              </Text>
            )}
          </View>
          <Text variant="caption" color={isUnread ? 'text.primary' : 'text.tertiary'} numberOfLines={1}>
            {item.lastMessage || 'Sin mensajes'}
          </Text>
        </View>
        {isUnread && (
          <View style={[styles.unreadDot, { backgroundColor: colors['action.primary'] }]} />
        )}
      </Pressable>
    );
  }, [userId, colors]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={colors['text.primary']} />
        </Pressable>
        <Text variant="h2">Mensajes</Text>
      </View>

      {loading ? (
        <SkeletonList count={5} />
      ) : chats.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="chatbubbles-outline" size={28} color={colors['text.tertiary']} />}
          title="Sin conversaciones"
          description="Cuando compartás un evento con alguien, la charla aparece acá."
          actionLabel="Explorar eventos"
          onAction={() => navigation.navigate('MainApp', { screen: 'Home' })}
        />
      ) : (
        <FlatList
          data={chats}
          keyExtractor={item => item.id}
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1 },
  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[5], paddingVertical: space[4], gap: space[3] },
  back:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chatRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[5], paddingVertical: space[3], gap: space[3], borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 72 },
  chatContent: { flex: 1, gap: 4 },
  chatHeader:  { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  unreadDot:   { width: 10, height: 10, borderRadius: 5 },
});

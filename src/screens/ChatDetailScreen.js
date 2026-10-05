// ChatDetailScreen — Chat individual
// LÓGICA INTACTA: mensajes en tiempo real, event-messages, date separators, mark-as-read.
// PRESENTACIÓN: design system v1.1 — tokens, Avatar, Text.
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet,
  TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '../components/ui/Avatar';
import Text from '../components/ui/Text';

import { auth, db } from '../config/firebase';
import useBlockedUsers from '../hooks/useBlockedUsers';
import { canWriteInChat, isGroupChat, markMessagesAsRead, sendMessage, subscribeToMessages } from '../services/chatService';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
}

function getDateKey(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDateSep(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return 'Hoy';
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-CR', { day: 'numeric', month: 'long' });
}

function isEventMessage(text) {
  return text?.includes('enfiestados.app/evento/');
}

function parseEventMessage(text) {
  const lines = text.split('\n');
  const title   = (lines.find(l => l.includes('Te comparto este evento:')) || '').replace('Te comparto este evento:', '').trim() || 'Evento';
  const dateTime = (lines.find(l => l.match(/\d{2}\/\d{2}\/\d{4}/)) || '').trim();
  const linkLine = lines.find(l => l.includes('enfiestados.app/evento/')) || '';
  const match    = linkLine.match(/evento\/([a-zA-Z0-9]+)/);
  return { title, dateTime, eventId: match?.[1] ?? '' };
}

// ─── ChatDetailScreen ─────────────────────────────────────────────────────────

export default function ChatDetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { chatId, otherUserId, otherUserName, otherUserAvatar } = route.params;

  const [messages,   setMessages]   = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser,  setOtherUser]  = useState({ name: otherUserName, avatar: otherUserAvatar });
  // Doc del chat: en grupos trae nombre, dueño, permiso de escritura y
  // miembros. Se escucha en vivo para que renombrar o cambiar el permiso se
  // refleje sin salir de la pantalla.
  const [chat,       setChat]       = useState(null);
  // Perfiles de los miembros, para poner nombre y avatar a cada burbuja: en
  // un grupo no alcanza con "mío / del otro".
  const [members,    setMembers]    = useState({});
  const listRef = useRef();
  const userId  = auth.currentUser?.uid;
  const { allBlocked } = useBlockedUsers();

  const group = isGroupChat(chat) || route.params?.isGroup === true;
  // En un directo el bloqueo corta el chat entero; en un grupo solo se ocultan
  // los mensajes de quien bloqueaste (ver abajo), porque la persona sigue
  // siendo miembro legítimo para el resto.
  const isBlocked = !group && allBlocked.has(otherUserId);
  const canWrite  = chat ? canWriteInChat(chat, userId) : true;

  useEffect(() => {
    const unsubChat = onSnapshot(doc(db, 'chats', chatId), snap => {
      if (snap.exists()) setChat({ id: snap.id, ...snap.data() });
    }, () => {});

    const unsub = subscribeToMessages(chatId, (msgs) => {
      setMessages(msgs);
      markMessagesAsRead(chatId, userId);
    });
    return () => { unsubChat(); unsub(); };
  }, [chatId]);

  useEffect(() => {
    if (group || !otherUserId) return;
    getDoc(doc(db, 'users', otherUserId))
      .then(snap => { if (snap.exists()) setOtherUser(snap.data()); })
      .catch(() => {});
  }, [group, otherUserId]);

  // Carga los perfiles que falten cuando cambia la lista de miembros.
  useEffect(() => {
    if (!group || !chat?.participants?.length) return;
    const missing = chat.participants.filter(id => !members[id]);
    if (!missing.length) return;

    let cancelled = false;
    Promise.all(missing.map(id => getDoc(doc(db, 'users', id)).catch(() => null)))
      .then(docs => {
        if (cancelled) return;
        const next = {};
        missing.forEach((id, i) => { if (docs[i]?.exists()) next[id] = docs[i].data(); });
        if (Object.keys(next).length) setMembers(prev => ({ ...prev, ...next }));
      });
    return () => { cancelled = true; };
  }, [group, chat?.participants]);

  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text || isBlocked || !canWrite) return;
    setNewMessage('');
    try { await sendMessage(chatId, userId, text); } catch {}
  };

  const handleEventPress = useCallback(async (eventId) => {
    try {
      const snap = await getDoc(doc(db, 'events', eventId));
      if (snap.exists()) navigation.navigate('EventDetail', { event: { id: snap.id, ...snap.data() } });
    } catch {}
  }, [navigation]);

  // Inyecta separadores de fecha + flags de agrupación (burbujas consecutivas)
  const data = useMemo(() => {
    if (!messages.length) return [];
    // En grupos se ocultan los mensajes de quien bloqueaste, pero la persona
    // sigue en el grupo. El filtro va antes de calcular la agrupación, para
    // que dos mensajes míos separados por uno oculto se agrupen bien.
    const vis = group ? messages.filter(m => !allBlocked.has(m.senderId)) : messages;
    if (!vis.length) return [];
    const sorted = [...vis].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    const result = [];
    let lastKey = '';
    for (let i = 0; i < sorted.length; i++) {
      const msg = sorted[i];
      const key = getDateKey(msg.timestamp);
      if (key !== lastKey) {
        result.push({ id: `sep-${msg.timestamp}`, type: 'separator', timestamp: msg.timestamp });
        lastKey = key;
      }
      const prev = sorted[i - 1];
      const next = sorted[i + 1];
      // Agrupación: consecutivos del mismo remitente en el mismo día
      const groupedWithPrev = !!(prev && prev.senderId === msg.senderId && getDateKey(prev.timestamp) === key);
      const groupedWithNext = !!(next && next.senderId === msg.senderId && getDateKey(next.timestamp) === key);
      result.push({ ...msg, type: 'message', groupedWithPrev, groupedWithNext });
    }
    return result;
  }, [messages, group, allBlocked]);

  const renderItem = useCallback(({ item }) => {
    if (item.type === 'separator') {
      return (
        <View style={styles.dateSep}>
          <View style={[styles.dateSepLine, { backgroundColor: colors['border.subtle'] }]} />
          <View style={[styles.dateSepPill, { backgroundColor: colors['bg.surface'] }]}>
            <Text variant="caption" color="text.tertiary">{formatDateSep(item.timestamp)}</Text>
          </View>
          <View style={[styles.dateSepLine, { backgroundColor: colors['border.subtle'] }]} />
        </View>
      );
    }

    const isMine  = item.senderId === userId;
    const isEvent = isEventMessage(item.text);
    const { groupedWithPrev, groupedWithNext } = item;
    // En un grupo cada burbuja puede ser de alguien distinto; en un directo
    // siempre es el mismo interlocutor.
    const sender = group ? (members[item.senderId] ?? {}) : otherUser;

    // Burbujas agrupadas: radio reducido en el lado del remitente para el grupo medio
    const bubbleRadius = {
      borderTopLeftRadius:     radius.lg,
      borderTopRightRadius:    radius.lg,
      borderBottomLeftRadius:  radius.lg,
      borderBottomRightRadius: radius.lg,
    };
    if (isMine) {
      if (groupedWithPrev) bubbleRadius.borderTopRightRadius = 4;
      if (groupedWithNext) bubbleRadius.borderBottomRightRadius = 4;
    } else {
      if (groupedWithPrev) bubbleRadius.borderTopLeftRadius = 4;
      if (groupedWithNext) bubbleRadius.borderBottomLeftRadius = 4;
    }

    // Color de burbuja propia: amarillo (action.primary) con texto oscuro — contraste AA
    const ownBg   = colors['action.primary'];
    const ownText = colors['text.onAction'];

    return (
      <View style={[
        styles.msgRow,
        isMine && styles.msgRowMine,
        groupedWithPrev && { marginBottom: 2 },  // espacio mínimo entre burbujas agrupadas
      ]}>
        {/* Avatar del otro solo en la última burbuja del grupo */}
        {!isMine && !groupedWithNext ? (
          <Avatar uri={sender.avatar} name={sender.name} size={28} style={{ marginRight: space[2] }} />
        ) : !isMine ? (
          <View style={{ width: 28 + space[2] }} />  // espacio reservado para alinear
        ) : null}

        {isEvent ? (() => {
          const ev = parseEventMessage(item.text);
          return (
            <Pressable
              style={[styles.eventCard, { backgroundColor: colors['bg.raised'], borderLeftColor: colors['action.primary'] }, isMine && styles.eventCardMine]}
              onPress={() => handleEventPress(ev.eventId)}
            >
              <View style={styles.eventCardHeader}>
                <Ionicons name="calendar-outline" size={14} color={colors['action.primary']} />
                <Text variant="caption" style={{ color: colors['action.primary'], marginLeft: space[1] }}>Evento compartido</Text>
              </View>
              <Text variant="title" numberOfLines={2} style={{ marginVertical: space[1] }}>{ev.title}</Text>
              {ev.dateTime && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="time-outline" size={13} color={colors['text.tertiary']} />
                  <Text variant="caption" color="text.tertiary">{ev.dateTime}</Text>
                </View>
              )}
              <View style={[styles.eventCardBtn, { backgroundColor: `${colors['action.primary']}20` }]}>
                <Text variant="label" style={{ color: colors['action.primary'] }}>Ver evento</Text>
                <Ionicons name="chevron-forward" size={14} color={colors['action.primary']} />
              </View>
              <Text variant="caption" color="text.tertiary" style={{ alignSelf: 'flex-end', marginTop: space[1] }}>{formatTime(item.timestamp)}</Text>
            </Pressable>
          );
        })() : (
          <View style={[
            styles.bubble,
            bubbleRadius,
            isMine
              ? { backgroundColor: ownBg }
              : { backgroundColor: colors['bg.surface'] },
          ]}>
            {/* Quién habla: solo en grupos, solo en ajenas, y solo en la
                primera de una tanda — repetirlo en cada burbuja es ruido. */}
            {group && !isMine && !groupedWithPrev && (
              <Text variant="caption" style={{ color: colors['link'], marginBottom: 2 }}>
                {sender.name ?? 'Usuario'}
              </Text>
            )}
            <Text variant="body" style={{ color: isMine ? ownText : colors['text.primary'] }}>
              {item.text}
            </Text>
            <Text variant="caption" style={{ color: isMine ? `${ownText}99` : colors['text.tertiary'], alignSelf: 'flex-end', marginTop: 3 }}>
              {formatTime(item.timestamp)}
            </Text>
          </View>
        )}
      </View>
    );
  }, [userId, otherUser, handleEventPress, colors, group, members, allBlocked]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors['border.subtle'] }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={colors['text.primary']} />
        </Pressable>
        <Pressable
          style={styles.headerUser}
          onPress={() => group
            ? navigation.navigate('GroupInfo', { chatId })
            : navigation.navigate('UserProfile', { userId: otherUserId })}
        >
          <Avatar
            uri={group ? null : otherUser.avatar}
            name={group ? (chat?.name ?? 'Grupo') : otherUser.name}
            size={36}
          />
          <View style={{ marginLeft: space[2], flex: 1 }}>
            <Text variant="title" numberOfLines={1}>
              {group ? (chat?.name ?? 'Grupo') : (otherUser.name || otherUserName)}
            </Text>
            {group && (
              <Text variant="caption" color="text.tertiary" numberOfLines={1}>
                {chat?.participants?.length ?? 0} miembros
                {chat?.writePolicy === 'owner' ? ' · solo lectura' : ''}
              </Text>
            )}
          </View>
        </Pressable>
      </View>

      {/* Mensajes */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Input */}
        {isBlocked ? (
          <View style={[styles.blockedBar, { backgroundColor: colors['bg.base'], borderTopColor: colors['border.subtle'] }]}>
            <Text variant="caption" color="text.tertiary" align="center">
              No podés enviar mensajes a este usuario.
            </Text>
          </View>
        ) : !canWrite ? (
          // Grupo con writePolicy 'owner': canal de avisos. Esto es solo la
          // UI — el corte real está en firestore.rules.
          <View style={[styles.blockedBar, { backgroundColor: colors['bg.base'], borderTopColor: colors['border.subtle'] }]}>
            <Text variant="caption" color="text.tertiary" align="center">
              Solo quien creó el grupo puede escribir acá.
            </Text>
          </View>
        ) : (
          <View style={[styles.inputBar, { backgroundColor: colors['bg.base'], borderTopColor: colors['border.subtle'] }]}>
            <TextInput
              style={[styles.input, { backgroundColor: colors['bg.surface'], color: colors['text.primary'] }]}
              placeholder="Escribí un mensaje…"
              placeholderTextColor={colors['text.tertiary']}
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
            />
            <Pressable
              style={[styles.sendBtn, { backgroundColor: colors['action.primary'] }]}
              onPress={handleSend}
              accessibilityLabel="Enviar mensaje"
            >
              <Ionicons name="send" size={20} color={colors['text.onAction']} />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[3], paddingVertical: space[3], borderBottomWidth: StyleSheet.hairlineWidth, gap: space[2] },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerUser: { flex: 1, flexDirection: 'row', alignItems: 'center' },

  list: { paddingHorizontal: space[4], paddingVertical: space[3], gap: space[2] },

  dateSep: { flexDirection: 'row', alignItems: 'center', marginVertical: space[3], gap: space[2] },
  dateSepLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dateSepPill: { paddingHorizontal: space[3], paddingVertical: 4, borderRadius: radius.full },

  msgRow:     { flexDirection: 'row', alignItems: 'flex-end', marginBottom: space[1] },
  msgRowMine: { justifyContent: 'flex-end' },

  bubble: {
    maxWidth: '75%',
    padding: space[3],
    borderRadius: radius.lg,
  },

  eventCard: {
    maxWidth: '80%',
    borderRadius: radius.lg,
    padding: space[3],
    borderLeftWidth: 4,
    gap: space[1],
  },
  eventCardMine: { borderLeftWidth: 0, borderRightWidth: 4 },
  eventCardHeader: { flexDirection: 'row', alignItems: 'center' },
  eventCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[2],
    borderRadius: radius.sm,
    marginTop: space[2],
    gap: 4,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space[3],
  },
  blockedBar: {
    paddingHorizontal: space[4],
    paddingVertical: space[4],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderRadius: radius.full,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_400Regular',
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

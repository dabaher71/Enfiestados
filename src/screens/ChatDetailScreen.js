// ChatDetailScreen — Chat individual
// LÓGICA INTACTA: mensajes en tiempo real, event-messages, date separators, mark-as-read.
// PRESENTACIÓN: design system v1.1 — tokens, Avatar, Text.
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet,
  TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '../components/ui/Avatar';
import Text from '../components/ui/Text';

import { auth, db } from '../config/firebase';
import { markMessagesAsRead, sendMessage, subscribeToMessages } from '../services/chatService';
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
  const listRef = useRef();
  const userId  = auth.currentUser?.uid;

  useEffect(() => {
    getDoc(doc(db, 'users', otherUserId))
      .then(snap => { if (snap.exists()) setOtherUser(snap.data()); })
      .catch(() => {});

    const unsub = subscribeToMessages(chatId, (msgs) => {
      setMessages(msgs);
      markMessagesAsRead(chatId, userId);
    });
    return () => unsub();
  }, [chatId]);

  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text) return;
    setNewMessage('');
    try { await sendMessage(chatId, userId, text); } catch {}
  };

  const handleEventPress = useCallback(async (eventId) => {
    try {
      const snap = await getDoc(doc(db, 'events', eventId));
      if (snap.exists()) navigation.navigate('EventDetail', { event: { id: snap.id, ...snap.data() } });
    } catch {}
  }, [navigation]);

  // Inyecta separadores de fecha
  const data = useMemo(() => {
    if (!messages.length) return [];
    const sorted = [...messages].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    const result = [];
    let lastKey = '';
    for (const msg of sorted) {
      const key = getDateKey(msg.timestamp);
      if (key !== lastKey) {
        result.push({ id: `sep-${msg.timestamp}`, type: 'separator', timestamp: msg.timestamp });
        lastKey = key;
      }
      result.push({ ...msg, type: 'message' });
    }
    return result;
  }, [messages]);

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

    return (
      <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
        {!isMine && <Avatar uri={otherUser.avatar} name={otherUser.name} size={28} style={{ marginRight: space[2] }} />}

        {isEvent ? (() => {
          const ev = parseEventMessage(item.text);
          return (
            <Pressable
              style={[styles.eventCard, { backgroundColor: colors['bg.raised'], borderLeftColor: colors['nav.selected'] }, isMine && styles.eventCardMine]}
              onPress={() => handleEventPress(ev.eventId)}
            >
              <View style={styles.eventCardHeader}>
                <Ionicons name="calendar-outline" size={14} color={colors['nav.selected']} />
                <Text variant="caption" style={{ color: colors['nav.selected'], marginLeft: space[1] }}>Evento compartido</Text>
              </View>
              <Text variant="title" numberOfLines={2} style={{ marginVertical: space[1] }}>{ev.title}</Text>
              {ev.dateTime && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="time-outline" size={13} color={colors['text.tertiary']} />
                  <Text variant="caption" color="text.tertiary">{ev.dateTime}</Text>
                </View>
              )}
              <View style={[styles.eventCardBtn, { backgroundColor: `${colors['nav.selected']}20` }]}>
                <Text variant="label" style={{ color: colors['nav.selected'] }}>Ver evento</Text>
                <Ionicons name="chevron-forward" size={14} color={colors['nav.selected']} />
              </View>
              <Text variant="caption" color="text.tertiary" style={{ alignSelf: 'flex-end', marginTop: space[1] }}>{formatTime(item.timestamp)}</Text>
            </Pressable>
          );
        })() : (
          <View style={[
            styles.bubble,
            isMine
              ? { backgroundColor: colors['nav.selected'], borderBottomRightRadius: 4 }
              : { backgroundColor: colors['bg.surface'], borderBottomLeftRadius: 4 },
          ]}>
            <Text variant="body" style={{ color: isMine ? colors['bg.base'] : colors['text.primary'] }}>
              {item.text}
            </Text>
            <Text variant="caption" style={{ color: isMine ? `${colors['bg.base']}99` : colors['text.tertiary'], alignSelf: 'flex-end', marginTop: 3 }}>
              {formatTime(item.timestamp)}
            </Text>
          </View>
        )}
      </View>
    );
  }, [userId, otherUser, handleEventPress, colors]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors['border.subtle'] }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={colors['text.primary']} />
        </Pressable>
        <Pressable
          style={styles.headerUser}
          onPress={() => navigation.navigate('UserProfile', { userId: otherUserId })}
        >
          <Avatar uri={otherUser.avatar} name={otherUser.name} size={36} />
          <Text variant="title" numberOfLines={1} style={{ marginLeft: space[2], flex: 1 }}>
            {otherUser.name || otherUserName}
          </Text>
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

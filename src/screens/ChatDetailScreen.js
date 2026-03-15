import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebase';
import { markMessagesAsRead, sendMessage, subscribeToMessages } from '../services/chatService';

export default function ChatDetailScreen({ route, navigation }) {
  const { chatId, otherUserId, otherUserName, otherUserAvatar } = route.params;
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState({ name: otherUserName, avatar: otherUserAvatar });
  const flatListRef = useRef();
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    loadOtherUser();

    const unsubscribe = subscribeToMessages(chatId, (newMessages) => {
      setMessages(newMessages);
      markMessagesAsRead(chatId, userId);
    });
    return () => unsubscribe();
  }, [chatId]);

  const loadOtherUser = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', otherUserId));
      if (userDoc.exists()) {
        setOtherUser(userDoc.data());
      }
    } catch (error) {
      console.log('Error cargando usuario:', error);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    const messageText = newMessage.trim();
    setNewMessage('');
    try {
      await sendMessage(chatId, userId, messageText);
    } catch (error) {
      console.error('Error enviando mensaje:', error);
    }
  };

  const isEventMessage = (text) => {
    return text && text.includes('enfiestados.app/evento/');
  };

  const parseEventMessage = (text) => {
    const lines = text.split('\n');
    const titleLine = lines.find(l => l.includes('Te comparto este evento:'));
    const dateLine = lines.find(l => l.match(/\d{2}\/\d{2}\/\d{4}/));
    const linkLine = lines.find(l => l.includes('enfiestados.app/evento/'));
    
    let title = 'Evento';
    let dateTime = '';
    let eventId = '';

    if (titleLine) {
      title = titleLine.replace('Te comparto este evento:', '').trim();
    }
    if (dateLine) {
      dateTime = dateLine.trim();
    }
    if (linkLine) {
      const match = linkLine.match(/evento\/([a-zA-Z0-9]+)/);
      if (match) eventId = match[1];
    }

    return { title, dateTime, eventId };
  };

  const handleEventPress = useCallback(async (eventId) => {
    try {
      const eventDoc = await getDoc(doc(db, 'events', eventId));
      if (eventDoc.exists()) {
        navigation.navigate('EventDetail', { event: { id: eventDoc.id, ...eventDoc.data() } });
      }
    } catch (error) {
      console.error('Error cargando evento:', error);
    }
  }, [navigation]);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  };

  const getDateString = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  };

  const formatDateSeparator = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Hoy';
    if (date.toDateString() === yesterday.toDateString()) return 'Ayer';
    return date.toLocaleDateString('es', { day: 'numeric', month: 'long' });
  };

  // useMemo: solo recalcula cuando cambia messages (O(n log n) → ejecutado una sola vez por batch)
  const data = useMemo(() => {
    if (messages.length === 0) return [];

    const result = [];
    let lastDateString = '';

    const sortedMessages = [...messages].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (const msg of sortedMessages) {
      const currentDateString = getDateString(msg.timestamp);
      if (currentDateString !== lastDateString) {
        result.push({ id: `separator-${msg.timestamp}`, type: 'separator', timestamp: msg.timestamp });
        lastDateString = currentDateString;
      }
      result.push({ ...msg, type: 'message' });
    }

    return result;
  }, [messages]);

  const renderItem = useCallback(({ item }) => {
    if (item.type === 'separator') {
      return (
        <View style={styles.dateSeparator}>
          <Text style={styles.dateSeparatorText}>{formatDateSeparator(item.timestamp)}</Text>
        </View>
      );
    }

    const isMyMessage = item.senderId === userId;
    const isEvent = isEventMessage(item.text);

    return (
      <View style={[styles.messageRow, isMyMessage && styles.myMessageRow]}>
        {!isMyMessage && (
          <Image source={otherUser.avatar ? { uri: otherUser.avatar } : require('../../assets/images/icon.png')} style={styles.messageAvatar} />
        )}
        {isEvent ? (
          (() => {
            // parseEventMessage una sola vez por item
            const parsed = parseEventMessage(item.text);
            return (
              <TouchableOpacity
                style={[styles.eventCard, isMyMessage && styles.myEventCard]}
                onPress={() => handleEventPress(parsed.eventId)}
              >
                <View style={styles.eventCardHeader}>
                  <Ionicons name="calendar" size={16} color="#6c5ce7" />
                  <Text style={styles.eventCardLabel}>Evento compartido</Text>
                </View>
                <Text style={styles.eventCardTitle}>{parsed.title}</Text>
                <View style={styles.eventCardFooter}>
                  <Ionicons name="time-outline" size={14} color="#888" />
                  <Text style={styles.eventCardDate}>{parsed.dateTime}</Text>
                </View>
                <View style={styles.eventCardButton}>
                  <Text style={styles.eventCardButtonText}>Ver evento</Text>
                  <Ionicons name="chevron-forward" size={16} color="#6c5ce7" />
                </View>
                <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
              </TouchableOpacity>
            );
          })()
        ) : (
          <View style={[styles.messageBubble, isMyMessage ? styles.myMessage : styles.otherMessage]}>
            <Text style={styles.messageText}>{item.text}</Text>
            <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
          </View>
        )}
      </View>
    );
  }, [userId, otherUser.avatar, handleEventPress]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerUser} onPress={() => navigation.navigate('UserProfile', { userId: otherUserId })}>
          {otherUser.avatar ? (
            <Image source={{ uri: otherUser.avatar }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={20} color="#888" />
            </View>
          )}
          <Text style={styles.headerName}>{otherUser.name || otherUserName}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.chatContainer} keyboardVerticalOffset={0}>
        <FlatList
          ref={flatListRef}
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Escribe un mensaje..."
            placeholderTextColor="#888"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <Ionicons name="send" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { paddingTop: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2d2d44' },
  backButton: { padding: 5 },
  headerUser: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  avatarPlaceholder: { backgroundColor: '#3d3d5c', justifyContent: 'center', alignItems: 'center' },
  headerName: { color: '#fff', fontSize: 18, fontWeight: '600' },
  menuButton: { padding: 5 },
  chatContainer: { flex: 1 },
  messagesList: { paddingHorizontal: 15, paddingVertical: 10 },
  dateSeparator: { alignItems: 'center', marginVertical: 15 },
  dateSeparatorText: { color: '#888', fontSize: 13, backgroundColor: '#2d2d44', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 15 },
  messageRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end' },
  myMessageRow: { justifyContent: 'flex-end' },
  messageAvatar: { width: 30, height: 30, borderRadius: 15, marginRight: 8 },
  messageBubble: { maxWidth: '75%', padding: 12, borderRadius: 18 },
  myMessage: { backgroundColor: '#6c5ce7', borderBottomRightRadius: 4 },
  otherMessage: { backgroundColor: '#2d2d44', borderBottomLeftRadius: 4 },
  messageText: { color: '#fff', fontSize: 15, lineHeight: 20 },
  messageTime: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 5, alignSelf: 'flex-end' },
  eventCard: { backgroundColor: '#2d2d44', borderRadius: 16, padding: 15, maxWidth: '80%', borderLeftWidth: 4, borderLeftColor: '#6c5ce7' },
  myEventCard: { borderLeftWidth: 0, borderRightWidth: 4, borderRightColor: '#6c5ce7' },
  eventCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  eventCardLabel: { color: '#6c5ce7', fontSize: 12, fontWeight: '600', marginLeft: 6 },
  eventCardTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  eventCardFooter: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  eventCardDate: { color: '#888', fontSize: 13, marginLeft: 5 },
  eventCardButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(108, 92, 231, 0.2)', paddingVertical: 8, borderRadius: 8 },
  eventCardButtonText: { color: '#6c5ce7', fontSize: 14, fontWeight: '600' },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 15, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#2d2d44' },
  input: { flex: 1, backgroundColor: '#2d2d44', borderRadius: 25, paddingHorizontal: 20, paddingVertical: 12, color: '#fff', fontSize: 16, maxHeight: 100 },
  sendButton: { backgroundColor: '#6c5ce7', width: 45, height: 45, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
});
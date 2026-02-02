import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { subscribeToChats } from '../services/chatService';

export default function ChatsScreen({ navigation }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usersData, setUsersData] = useState({});

  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    const unsubscribe = subscribeToChats(currentUserId, async (newChats) => {
      setChats(newChats);
      
      // Cargar datos de los otros usuarios
      for (const chat of newChats) {
        const otherUserId = chat.participants.find(id => id !== currentUserId);
        if (otherUserId && !usersData[otherUserId]) {
          const userDoc = await getDoc(doc(db, 'users', otherUserId));
          if (userDoc.exists()) {
            setUsersData(prev => ({
              ...prev,
              [otherUserId]: userDoc.data()
            }));
          }
        }
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const formatTime = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  const handleChatPress = (chat) => {
    const otherUserId = chat.participants.find(id => id !== currentUserId);
    const otherUser = usersData[otherUserId];
    
    navigation.navigate('ChatDetail', { 
      chatId: chat.id,
      otherUserId,
      otherUserName: otherUser?.name || 'Usuario',
      otherUserAvatar: otherUser?.avatar || '',
    });
  };

  const renderChat = ({ item }) => {
    const otherUserId = item.participants.find(id => id !== currentUserId);
    const otherUser = usersData[otherUserId];

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => handleChatPress(item)}
      >
        <Image
          source={{ uri: otherUser?.avatar || 'https://via.placeholder.com/50' }}
          style={styles.avatar}
        />
        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={styles.userName}>{otherUser?.name || 'Usuario'}</Text>
            <Text style={styles.timeText}>{formatTime(item.lastMessageTime)}</Text>
          </View>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage || 'Inicia una conversación'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6c5ce7" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mensajes</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Lista de chats */}
      {chats.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={60} color="#888" />
          <Text style={styles.emptyTitle}>Sin conversaciones</Text>
          <Text style={styles.emptyText}>
            Tus mensajes aparecerán aquí
          </Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={renderChat}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  avatar: {
    width: 55,
    height: 55,
    borderRadius: 28,
    backgroundColor: '#2d2d44',
  },
  chatContent: {
    flex: 1,
    marginLeft: 15,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  timeText: {
    fontSize: 12,
    color: '#888',
  },
  lastMessage: {
    fontSize: 14,
    color: '#888',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 15,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});

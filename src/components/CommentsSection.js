import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from '../config/firebase';
import { addComment } from '../services/eventService';
//import { createNotification, NOTIFICATION_TYPES } from '../services/notificationService';

export default function CommentsSection({ eventId, comments: initialComments, organizerId }) {
  const [comments, setComments] = useState(initialComments || []);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  const user = auth.currentUser;

  const [currentUserData, setCurrentUserData] = useState(null);

useEffect(() => {
  const fetchUserData = async () => {
    const userId = auth.currentUser?.uid;
    if (userId) {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setCurrentUserData(userDoc.data());
      }
    }
  };
  fetchUserData();
}, []);


  // intenta varios campos posibles para identificar al autor del comentario
  const getCommentUserId = (c) => c.userId || c.uid || c.authorId || (c.user && (c.user.uid || c.user.id)) || c.ownerId;

  // refresa avatars/nombres usando la colección 'users'
  const refreshCommentsProfiles = async (incomingComments) => {
    if (!incomingComments || incomingComments.length === 0) {
      setComments([]);
      return;
    }

    const uniqueIds = [...new Set(incomingComments.map(c => getCommentUserId(c)).filter(Boolean))];
    if (uniqueIds.length === 0) {
      setComments(incomingComments);
      return;
    }

    const userMap = {};
    for (const uid of uniqueIds) {
      try {
        const uDoc = await getDoc(doc(db, 'users', uid));
        if (uDoc.exists()) {
          userMap[uid] = uDoc.data();
        }
      } catch (err) {
        console.error('Error cargando usuario de comentario', uid, err);
      }
    }

    const updated = incomingComments.map(c => {
      const cid = getCommentUserId(c);
      const nameFromComment = c.userName || c.name || c.authorName;
      const avatarFromComment = c.userAvatar || c.avatar || c.authorAvatar;
      if (cid && userMap[cid]) {
        return {
          ...c,
          userAvatar: userMap[cid].avatar || avatarFromComment || '',
          userName: userMap[cid].name || userMap[cid].displayName || nameFromComment || 'Usuario',
        };
      }
      // normalizar claves por si vienen con otros nombres
      return {
        ...c,
        userAvatar: avatarFromComment || '',
        userName: nameFromComment || 'Usuario',
      };
    });

    setComments(updated);
  };

  // cuando el prop cambia, refrescar perfiles
  useEffect(() => {
    refreshCommentsProfiles(initialComments || []);
  }, [initialComments]);

  const handleSubmit = async () => {
  if (!newComment.trim()) return;

  setLoading(true);
  try {
    const userId = auth.currentUser?.uid;
    const userName = currentUserData?.name || auth.currentUser?.displayName || auth.currentUser?.email.split('@')[0];
    const userAvatar = currentUserData?.avatar || auth.currentUser?.photoURL || '';

    const comment = await addComment(eventId, {
      userId,
      userName,
      userAvatar,
      text: newComment.trim(),
    });

    setComments(prev => [...prev, {
      ...comment,
      userAvatar,
      userName,
    }]);

    if (organizerId && organizerId !== userId) {
      await createNotification({
        type: NOTIFICATION_TYPES.COMMENT,
        fromUserId: userId,
        fromUserName: userName,
        fromUserAvatar: userAvatar,
        toUserId: organizerId,
        message: `comentó: "${newComment.trim().substring(0, 50)}${newComment.length > 50 ? '...' : ''}"`,
        eventId: eventId,
      });
    }

    setNewComment('');
  } catch (error) {
    console.error('Error al comentar:', error);
  }
  setLoading(false);
};


  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  const renderComment = ({ item }) => (
  <View style={styles.commentItem}>
    <Image
      source={{ uri: item.userAvatar || 'https://via.placeholder.com/40' }}
      style={styles.commentAvatar}
    />
    <View style={styles.commentContent}>
      <View style={styles.commentHeader}>
        <Text style={styles.commentUser}>{item.userName || item.name || 'Usuario'}</Text>
        <Text style={styles.commentTime}>{formatDate(item.createdAt)}</Text>
      </View>
      <Text style={styles.commentText}>{item.text}</Text>
    </View>
  </View>
);


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Comentarios ({comments.length})</Text>

      {comments.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubble-outline" size={40} color="#888" />
          <Text style={styles.emptyText}>No hay comentarios aún</Text>
          <Text style={styles.emptySubtext}>Sé el primero en comentar</Text>
        </View>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={renderComment}
          scrollEnabled={false}
        />
      )}

      {/* Input para nuevo comentario */}
      <View style={styles.inputContainer}>
  <TextInput
    style={styles.input}
    placeholder="Escribe un comentario..."
    placeholderTextColor="#888"
    value={newComment}
    onChangeText={setNewComment}
    multiline
  />
  <TouchableOpacity
    style={[styles.sendButton, (!newComment.trim() || loading) && styles.sendButtonDisabled]}
    onPress={handleSubmit}
    disabled={!newComment.trim() || loading}
  >
    <Ionicons 
      name="send" 
      size={20} 
      color={newComment.trim() && !loading ? '#6c5ce7' : '#888'} 
    />
  </TouchableOpacity>
</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    marginBottom: Platform.OS === 'android' ? 100 : 20,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    marginTop: 10,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 5,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: '#3d3d5c',
  },
  commentContent: {
    flex: 1,
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentUser: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  commentTime: {
    color: '#888',
    fontSize: 12,
  },
  commentText: {
    color: '#ddd',
    fontSize: 14,
    lineHeight: 20,
  },
  inputContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#2d2d44',
  borderRadius: 25,
  paddingHorizontal: 10,
  paddingVertical: 5,
  marginTop: 15,
},
  inputAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: '#3d3d5c',
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    maxHeight: 80,
    paddingVertical: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

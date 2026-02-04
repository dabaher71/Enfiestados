import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  Alert,
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
import { addComment, deleteComment } from '../services/eventService';

export default function CommentsSection({ eventId, comments: initialComments, organizerId }) {
  const [comments, setComments] = useState(initialComments || []);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  const user = auth.currentUser;
  const userId = user?.uid;

  const [currentUserData, setCurrentUserData] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      if (userId) {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          setCurrentUserData(userDoc.data());
        }
      }
    };
    fetchUserData();
  }, []);

  const getCommentUserId = (c) => c.userId || c.uid || c.authorId || (c.user && (c.user.uid || c.user.id)) || c.ownerId;

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
      return {
        ...c,
        userAvatar: avatarFromComment || '',
        userName: nameFromComment || 'Usuario',
      };
    });

    setComments(updated);
  };

  useEffect(() => {
    refreshCommentsProfiles(initialComments || []);
  }, [initialComments]);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      const userName = currentUserData?.name || user?.displayName || user?.email.split('@')[0];
      const userAvatar = currentUserData?.avatar || user?.photoURL || '';

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

      setNewComment('');
    } catch (error) {
      console.error('Error al comentar:', error);
    }
    setLoading(false);
  };

  const handleDelete = (comment) => {
    const commentOwnerId = getCommentUserId(comment);
    const isMyComment = commentOwnerId === userId;
    const isOrganizer = organizerId === userId;

    if (!isMyComment && !isOrganizer) return;

    Alert.alert(
      'Eliminar comentario',
      '¿Estás seguro de que quieres eliminar este comentario?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteComment(eventId, comment.id);
              setComments(prev => prev.filter(c => c.id !== comment.id));
            } catch (error) {
              console.error('Error eliminando comentario:', error);
              Alert.alert('Error', 'No se pudo eliminar el comentario');
            }
          },
        },
      ]
    );
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

  const renderComment = ({ item }) => {
    const commentOwnerId = getCommentUserId(item);
    const isMyComment = commentOwnerId === userId;
    const isOrganizer = organizerId === userId;
    const canDelete = isMyComment || isOrganizer;

    return (
      <TouchableOpacity
        style={styles.commentItem}
        onLongPress={() => canDelete && handleDelete(item)}
        activeOpacity={canDelete ? 0.7 : 1}
        delayLongPress={500}
      >
        <Image
          source={{ uri: item.userAvatar || 'https://via.placeholder.com/40' }}
          style={styles.commentAvatar}
        />
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentUser}>{item.userName || item.name || 'Usuario'}</Text>
            <View style={styles.commentHeaderRight}>
              <Text style={styles.commentTime}>{formatDate(item.createdAt)}</Text>
              {canDelete && (
                <TouchableOpacity
                  onPress={() => handleDelete(item)}
                  style={styles.deleteButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="trash-outline" size={14} color="#e74c3c" />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <Text style={styles.commentText}>{item.text}</Text>
        </View>
      </TouchableOpacity>
    );
  };

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
    marginBottom: Platform.OS === 'android' ? 65 : 20,
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
    alignItems: 'center',
    marginBottom: 4,
  },
  commentHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  deleteButton: {
    padding: 4,
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
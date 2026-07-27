import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import Avatar from './ui/Avatar';
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from '../config/firebase';
import { addComment, deleteComment } from '../services/eventService';
import { createNotification, NOTIFICATION_TYPES } from '../services/notificationService';
import { recordSignal } from '../services/signalService';
import { useTheme } from '../theme/ThemeProvider';

const MAX_COMMENT_LENGTH = 500;
const COMMENT_COOLDOWN_MS = 5000;

export default function CommentsSection({ eventId, comments: initialComments, organizerId, event, onUserPress }) {
  const { colors } = useTheme();
  const [comments, setComments] = useState(initialComments || []);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const lastCommentTime = useRef(0);

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
  }, [userId]);

  const getCommentUserId = (c) => c.userId || c.uid || c.authorId || (c.user && (c.user.uid || c.user.id)) || c.ownerId;

  const refreshCommentsProfiles = useCallback(async (incomingComments) => {
    if (!incomingComments || incomingComments.length === 0) {
      setComments([]);
      return;
    }

    const uniqueIds = [...new Set(incomingComments.map(c => getCommentUserId(c)).filter(Boolean))];
    if (uniqueIds.length === 0) {
      setComments(incomingComments);
      return;
    }

    // Promise.all: carga todos los perfiles en paralelo en vez de secuencialmente
    const userDocs = await Promise.all(
      uniqueIds.map(uid => getDoc(doc(db, 'users', uid)).catch(() => null))
    );
    const userMap = {};
    uniqueIds.forEach((uid, i) => {
      if (userDocs[i]?.exists()) userMap[uid] = userDocs[i].data();
    });

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
  }, []);

  useEffect(() => {
    refreshCommentsProfiles(initialComments || []);
  }, [initialComments, refreshCommentsProfiles]);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    const now = Date.now();
    if (now - lastCommentTime.current < COMMENT_COOLDOWN_MS) {
      Alert.alert('Espera un momento', 'Puedes comentar cada 5 segundos.');
      return;
    }

    setLoading(true);
    try {
      const userName = currentUserData?.name || user?.displayName || user?.email.split('@')[0];
      const userAvatar = currentUserData?.avatar || user?.photoURL || '';

      lastCommentTime.current = Date.now();
      const comment = await addComment(eventId, {
        userId,
        userName,
        userAvatar,
        text: newComment.trim().slice(0, MAX_COMMENT_LENGTH),
      });

      setComments(prev => [...prev, { ...comment, userAvatar, userName }]);
      setNewComment('');
      if (event) recordSignal(userId, event, 'comment');

      // Notificar al organizador si no es su propio comentario
      if (organizerId && organizerId !== userId) {
        createNotification({
          type: NOTIFICATION_TYPES.COMMENT,
          fromUserId: userId,
          fromUserName: userName,
          fromUserAvatar: userAvatar,
          toUserId: organizerId,
          message: 'comentó en tu evento',
          eventId,
        }).catch(() => {});
      }
    } catch (error) {
      console.error('Error al comentar:', error);
    }
    setLoading(false);
  };

  const handleDelete = useCallback((comment) => {
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
              await deleteComment(eventId, comment.id, userId);
              setComments(prev => prev.filter(c => c.id !== comment.id));
            } catch (error) {
              console.error('Error eliminando comentario:', error);
              Alert.alert('Error', 'No se pudo eliminar el comentario');
            }
          },
        },
      ]
    );
  }, [userId, organizerId, eventId]);

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

  const renderComment = useCallback(({ item }) => {
    const commentOwnerId = getCommentUserId(item);
    const isMyComment = commentOwnerId === userId;
    const isOrganizer = organizerId === userId;
    const canDelete = isMyComment || isOrganizer;

    const commentUserId = commentOwnerId;

    return (
      <TouchableOpacity
        style={styles.commentItem}
        onLongPress={() => canDelete && handleDelete(item)}
        activeOpacity={canDelete ? 0.7 : 1}
        delayLongPress={500}
      >
        <TouchableOpacity
          onPress={() => commentUserId && onUserPress?.(commentUserId)}
          activeOpacity={0.8}
        >
          <Avatar uri={item.userAvatar} name={item.userName} size={36} style={styles.commentAvatar} />
        </TouchableOpacity>
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentUser}>{item.userName || item.name || 'Usuario'}</Text>
            <View style={styles.commentHeaderRight}>
              <Text style={styles.commentTime}>{formatDate(item.createdAt)}</Text>
              {canDelete && (
                <TouchableOpacity
                  onPress={() => handleDelete(item)}
                  style={styles.deleteButton}
                  hitSlop={styles.deleteHitSlop}
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
  }, [userId, organizerId, handleDelete]);

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

      {/* § 5.1: bg.surface + botón enviar amarillo 52px (no flecha gris) */}
      <View style={[styles.inputContainer, { backgroundColor: colors['bg.surface'], borderColor: colors['border.strong'] }]}>
        <TextInput
          style={[styles.input, { color: colors['text.primary'], fontFamily: 'PlusJakartaSans_400Regular' }]}
          placeholder="Comentá…"
          placeholderTextColor={colors['text.tertiary']}
          value={newComment}
          onChangeText={(t) => setNewComment(t.slice(0, MAX_COMMENT_LENGTH))}
          multiline
          maxLength={MAX_COMMENT_LENGTH}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            { backgroundColor: newComment.trim() && !loading ? colors['action.primary'] : colors['bg.raised'] },
          ]}
          onPress={handleSubmit}
          disabled={!newComment.trim() || loading}
          accessibilityLabel="Enviar comentario"
        >
          <Ionicons
            name="send"
            size={18}
            color={newComment.trim() && !loading ? colors['text.onAction'] : colors['text.tertiary']}
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
  deleteHitSlop: { top: 10, bottom: 10, left: 10, right: 10 },
  commentText: {
    color: '#ddd',
    fontSize: 14,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 15,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    maxHeight: 80,
    paddingVertical: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  sendButtonDisabled: { opacity: 0.5 },
});
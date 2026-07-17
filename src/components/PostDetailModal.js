import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useState } from 'react';
import { Image } from 'expo-image';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import ImageViewerModal from './ImageViewerModal';
import UserAvatar from './UserAvatar';
import ReportModal from './ReportModal';

function timeAgo(date) {
  if (!date) return '';
  const now = new Date();
  const d = date.toDate ? date.toDate() : new Date(date);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'Ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function PostDetailModal({
  post,
  visible,
  onClose,
  currentUserId,
  onLike,
  onComment,
  onDelete,
  onUserPress,
}) {
  const [commentText, setCommentText] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);

  const isLiked = post?.likes?.includes(currentUserId);
  const isOwner = post?.userId === currentUserId;

  const handleDelete = useCallback(() => {
    Alert.alert('Eliminar', '¿Eliminar esta publicación?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          onDelete?.(post.id);
          onClose();
        },
      },
    ]);
  }, [post?.id, onDelete, onClose]);

  const handleComment = useCallback(() => {
    if (!commentText.trim()) return;
    onComment?.(post.id, commentText.trim());
    setCommentText('');
  }, [commentText, post?.id, onComment]);

  const handleLike = useCallback(() => onLike?.(post.id), [post?.id, onLike]);

  const handleUserPress = useCallback(() => {
    onClose();
    onUserPress?.(post.userId);
  }, [post?.userId, onUserPress, onClose]);

  if (!post) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheet}
        >
          {/* Header con botón cerrar */}
          <View style={styles.handle}>
            <View style={styles.handleBar} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Imagen */}
            {post.image ? (
              <TouchableOpacity activeOpacity={0.9} onPress={() => setShowImageViewer(true)}>
                <Image
                  source={{ uri: post.image }}
                  style={styles.image}
                  contentFit="cover"
                  transition={200}
                />
              </TouchableOpacity>
            ) : null}

            <View style={styles.content}>
              {/* Usuario + acciones */}
              <View style={styles.header}>
                <TouchableOpacity style={styles.userInfo} onPress={handleUserPress}>
                  <UserAvatar uri={post.userAvatar} size={42} style={styles.avatar} />
                  <View>
                    <Text style={styles.userName}>{post.userName}</Text>
                    <Text style={styles.time}>{timeAgo(post.createdAt)}</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.headerActions}>
                  {isOwner ? (
                    <TouchableOpacity onPress={handleDelete} style={styles.iconBtn}>
                      <Ionicons name="trash-outline" size={20} color="#ff4444" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => setShowReport(true)} style={styles.iconBtn}>
                      <Ionicons name="flag-outline" size={20} color="#888" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
                    <Ionicons name="close" size={22} color="#888" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Texto */}
              {post.text ? (
                <Text style={styles.text}>{post.text}</Text>
              ) : null}

              {/* Like */}
              <View style={styles.actions}>
                <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
                  <Ionicons
                    name={isLiked ? 'heart' : 'heart-outline'}
                    size={22}
                    color={isLiked ? '#ff4444' : '#aaa'}
                  />
                  <Text style={[styles.actionText, isLiked && styles.likedText]}>
                    {post.likes?.length || 0}
                  </Text>
                </TouchableOpacity>
                <View style={styles.actionBtn}>
                  <Ionicons name="chatbubble-outline" size={20} color="#aaa" />
                  <Text style={styles.actionText}>{post.comments?.length || 0}</Text>
                </View>
              </View>

              {/* Comentarios */}
              <View style={styles.commentsSection}>
                {post.comments?.length > 0 ? (
                  post.comments.map((c, i) => (
                    <View key={c.createdAt ?? i} style={styles.comment}>
                      <TouchableOpacity
                        onPress={() => { if (c.userId) { onClose(); onUserPress?.(c.userId); } }}
                        activeOpacity={0.8}
                      >
                        <UserAvatar uri={c.userAvatar} size={30} style={styles.commentAvatar} />
                      </TouchableOpacity>
                      <View style={styles.commentBubble}>
                        <Text style={styles.commentUser}>{c.userName}</Text>
                        <Text style={styles.commentText}>{c.text}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noComments}>Sé el primero en comentar</Text>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Input de comentario */}
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.input}
              placeholder="Escribe un comentario..."
              placeholderTextColor="#666"
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity onPress={handleComment} disabled={!commentText.trim()}>
              <Ionicons
                name="send"
                size={22}
                color={commentText.trim() ? '#6c5ce7' : '#444'}
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>

      <ReportModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        targetType="post"
        targetId={post.id}
      />
      <ImageViewerModal
        uri={post.image}
        visible={showImageViewer}
        onClose={() => setShowImageViewer(false)}
      />
    </Modal>
  );
}

export default memo(PostDetailModal);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  handle: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#444',
  },
  image: {
    width: '100%',
    height: 320,
    backgroundColor: '#2d2d44',
  },
  content: {
    padding: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
    backgroundColor: '#3d3d54',
  },
  userName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  time: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  iconBtn: {
    padding: 6,
  },
  text: {
    color: '#ddd',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#3d3d54',
    marginBottom: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 25,
  },
  actionText: {
    color: '#aaa',
    marginLeft: 6,
    fontSize: 14,
  },
  likedText: {
    color: '#ff4444',
  },
  commentsSection: {
    gap: 12,
  },
  comment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  commentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#3d3d54',
    flexShrink: 0,
  },
  commentBubble: {
    flex: 1,
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentUser: {
    color: '#6c5ce7',
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 2,
  },
  commentText: {
    color: '#ccc',
    fontSize: 13,
    lineHeight: 18,
  },
  noComments: {
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 10,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#3d3d54',
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    maxHeight: 80,
  },
});

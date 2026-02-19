import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function PostCard({ post, currentUserId, onLike, onComment, onDelete, onUserPress }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const isLiked = post.likes?.includes(currentUserId);
  const isOwner = post.userId === currentUserId;

  const timeAgo = (date) => {
    if (!date) return '';
    const now = new Date();
    const postDate = date.toDate ? date.toDate() : new Date(date);
    const diff = Math.floor((now - postDate) / 1000);
    if (diff < 60) return 'Ahora';
    if (diff < 3600) return Math.floor(diff / 60) + 'm';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    return Math.floor(diff / 86400) + 'd';
  };

  const handleDelete = () => {
    Alert.alert('Eliminar', 'Eliminar esta publicacion?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => onDelete?.(post.id) },
    ]);
  };

  const handleComment = () => {
    if (!commentText.trim()) return;
    onComment?.(post.id, commentText.trim());
    setCommentText('');
  };

  return (
    <View style={styles.card}>
      {post.image ? (
        <Image source={{ uri: post.image }} style={styles.postImage} resizeMode="cover" />
      ) : null}

      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.userInfo} onPress={() => onUserPress?.(post.userId)}>
            <Image source={{ uri: post.userAvatar || 'https://via.placeholder.com/36' }} style={styles.avatar} />
            <View>
              <Text style={styles.userName}>{post.userName}</Text>
              <Text style={styles.time}>{timeAgo(post.createdAt)}</Text>
            </View>
          </TouchableOpacity>
          {isOwner && (
            <TouchableOpacity onPress={handleDelete}>
              <Ionicons name="trash-outline" size={18} color="#ff4444" />
            </TouchableOpacity>
          )}
        </View>

        {post.text ? <Text style={styles.text}>{post.text}</Text> : null}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onLike?.(post.id)}>
            <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={20} color={isLiked ? '#ff4444' : '#aaa'} />
            <Text style={[styles.actionText, isLiked && { color: '#ff4444' }]}>{post.likes?.length || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowComments(!showComments)}>
            <Ionicons name="chatbubble-outline" size={18} color="#aaa" />
            <Text style={styles.actionText}>{post.comments?.length || 0}</Text>
          </TouchableOpacity>
        </View>

        {showComments && (
          <View style={styles.commentsSection}>
            {post.comments?.map((c, i) => (
              <View key={i} style={styles.comment}>
                <Text style={styles.commentUser}>{c.userName}</Text>
                <Text style={styles.commentText}>{c.text}</Text>
              </View>
            ))}
            <View style={styles.commentInput}>
              <TextInput
                style={styles.input}
                placeholder="Escribe un comentario..."
                placeholderTextColor="#666"
                value={commentText}
                onChangeText={setCommentText}
              />
              <TouchableOpacity onPress={handleComment}>
                <Ionicons name="send" size={20} color="#6c5ce7" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#2d2d44', marginHorizontal: 15, marginBottom: 15, borderRadius: 20, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  postImage: { width: '100%', height: 220 },
  content: { padding: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: '#3d3d54' },
  userName: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  time: { color: '#888', fontSize: 11, marginTop: 1 },
  text: { color: '#ddd', fontSize: 15, lineHeight: 22, marginBottom: 12 },
  actions: { flexDirection: 'row', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#3d3d54' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 25 },
  actionText: { color: '#aaa', marginLeft: 5, fontSize: 13 },
  commentsSection: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#3d3d54' },
  comment: { flexDirection: 'row', marginBottom: 8 },
  commentUser: { color: '#6c5ce7', fontWeight: 'bold', fontSize: 12, marginRight: 8 },
  commentText: { color: '#ccc', fontSize: 12, flex: 1 },
  commentInput: { flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: '#1a1a2e', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  input: { flex: 1, color: '#fff', fontSize: 13 },
});

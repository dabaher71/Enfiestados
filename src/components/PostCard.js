import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../config/firebase';
import { toggleLikePost, addComment, deletePost } from '../services/postService';

export default function PostCard({ post, onUserPress }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const currentUser = auth.currentUser;
  const isLiked = post.likes?.includes(currentUser?.uid);
  const isOwner = post.userId === currentUser?.uid;

  const timeAgo = (date) => {
    if (!date) return '';
    const now = new Date();
    const postDate = date.toDate ? date.toDate() : new Date(date);
    const diff = Math.floor((now - postDate) / 1000);
    if (diff < 60) return 'Ahora';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const handleLike = () => toggleLikePost(post.id);

  const handleComment = async () => {
    if (!commentText.trim()) return;
    await addComment(post.id, commentText.trim());
    setCommentText('');
  };

  const handleDelete = () => {
    Alert.alert('Eliminar', '¿Eliminar esta publicación?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deletePost(post.id) },
    ]);
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.userInfo} onPress={() => onUserPress?.(post.userId)}>
          <Image
            source={{ uri: post.userAvatar || 'https://via.placeholder.com/40' }}
            style={styles.avatar}
          />
          <View>
            <Text style={styles.userName}>{post.userName}</Text>
            <Text style={styles.time}>{timeAgo(post.createdAt)}</Text>
          </View>
        </TouchableOpacity>
        {isOwner && (
          <TouchableOpacity onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color="#ff4444" />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {post.text ? <Text style={styles.text}>{post.text}</Text> : null}
      {post.image ? (
        <Image source={{ uri: post.image }} style={styles.postImage} resizeMode="cover" />
      ) : null}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
          <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={22} color={isLiked ? '#ff4444' : '#888'} />
          <Text style={[styles.actionText, isLiked && { color: '#ff4444' }]}>{post.likes?.length || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setShowComments(!showComments)}>
          <Ionicons name="chatbubble-outline" size={20} color="#888" />
          <Text style={styles.actionText}>{post.comments?.length || 0}</Text>
        </TouchableOpacity>
      </View>

      {/* Comments */}
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
              <Ionicons name="send" size={22} color="#6c5ce7" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#2d2d44', marginHorizontal: 15, marginBottom: 15, borderRadius: 15, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10, backgroundColor: '#3d3d54' },
  userName: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  time: { color: '#888', fontSize: 12, marginTop: 2 },
  text: { color: '#ddd', fontSize: 15, paddingHorizontal: 15, paddingBottom: 10, lineHeight: 22 },
  postImage: { width: '100%', height: 250 },
  actions: { flexDirection: 'row', padding: 15, borderTopWidth: 1, borderTopColor: '#3d3d54' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 25 },
  actionText: { color: '#888', marginLeft: 6, fontSize: 14 },
  commentsSection: { paddingHorizontal: 15, paddingBottom: 15, borderTopWidth: 1, borderTopColor: '#3d3d54' },
  comment: { flexDirection: 'row', marginTop: 10 },
  commentUser: { color: '#6c5ce7', fontWeight: 'bold', fontSize: 13, marginRight: 8 },
  commentText: { color: '#ccc', fontSize: 13, flex: 1 },
  commentInput: { flexDirection: 'row', alignItems: 'center', marginTop: 10, backgroundColor: '#1a1a2e', borderRadius: 25, paddingHorizontal: 15, paddingVertical: 8 },
  input: { flex: 1, color: '#fff', fontSize: 14 },
});

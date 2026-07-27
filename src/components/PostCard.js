// PostCard — publicación de usuario
// FIX_ROUND_1 § 5.5: text.primary para nombre, tiempo relativo humano,
// stats ocultos cuando son 0, eliminar detrás del "···", bg.surface + radius.lg.
import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useState } from 'react';
import { Image } from 'expo-image';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import PostDetailModal from './PostDetailModal';
import Avatar from './ui/Avatar';
import ReportModal from './ReportModal';
import Text from './ui/Text';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';

// "hace 2 h" · "hace 5 meses" · "hace 3 años" — nunca "157d"
function timeAgo(date) {
  if (!date) return '';
  const postDate = date.toDate ? date.toDate() : new Date(date);
  const diff = Math.floor((Date.now() - postDate) / 1000);
  if (diff < 60)       return 'Ahora';
  if (diff < 3600)     return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400)    return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 2592000)  return `hace ${Math.floor(diff / 86400)} días`;
  if (diff < 31536000) return `hace ${Math.floor(diff / 2592000)} meses`;
  return `hace ${Math.floor(diff / 31536000)} años`;
}

function PostCard({ post, currentUserId, onLike, onComment, onDelete, onUserPress }) {
  const { colors } = useTheme();
  const [showComments, setShowComments] = useState(false);
  const [commentText,  setCommentText]  = useState('');
  const [showReport,   setShowReport]   = useState(false);
  const [showDetail,   setShowDetail]   = useState(false);
  const [showMenu,     setShowMenu]     = useState(false);

  const isLiked = post.likes?.includes(currentUserId);
  const isOwner = post.userId === currentUserId;
  const likeCount    = post.likes?.length ?? 0;
  const commentCount = post.comments?.length ?? 0;

  const handleDelete = useCallback(() => {
    setShowMenu(false);
    Alert.alert('¿Eliminar publicación?', 'Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => onDelete?.(post.id) },
    ]);
  }, [post.id, onDelete]);

  const handleComment = useCallback(() => {
    if (!commentText.trim()) return;
    onComment?.(post.id, commentText.trim());
    setCommentText('');
  }, [commentText, post.id, onComment]);

  return (
    <Pressable
      style={[styles.card, { backgroundColor: colors['bg.surface'] }]}
      onPress={() => setShowDetail(true)}
      accessibilityRole="button"
    >
      <ReportModal visible={showReport} onClose={() => setShowReport(false)} targetType="post" targetId={post.id} />
      <PostDetailModal
        post={post}
        visible={showDetail}
        onClose={() => setShowDetail(false)}
        currentUserId={currentUserId}
        onLike={onLike}
        onComment={onComment}
        onDelete={onDelete}
        onUserPress={onUserPress}
      />

      {/* Imagen — respeta relación de aspecto */}
      {post.image ? (
        <Image
          source={{ uri: post.image }}
          style={styles.postImage}
          contentFit="cover"
          transition={200}
        />
      ) : null}

      <View style={styles.content}>
        {/* Header: avatar + nombre + tiempo + menú ··· */}
        <View style={styles.header}>
          <Pressable
            style={styles.userInfo}
            onPress={() => onUserPress?.(post.userId)}
            accessibilityRole="button"
          >
            <Avatar uri={post.userAvatar} name={post.userName} size={36} />
            <View style={{ marginLeft: space[2] }}>
              {/* Nombre en text.primary, NO violeta */}
              <Text variant="title" style={{ fontSize: 14 }}>{post.userName}</Text>
              <Text variant="caption" color="text.tertiary">{timeAgo(post.createdAt)}</Text>
            </View>
          </Pressable>

          {/* Menú ··· — eliminar/reportar detrás del menú */}
          <Pressable
            onPress={() => setShowMenu(v => !v)}
            style={styles.menuBtn}
            accessibilityLabel="Más opciones"
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={colors['text.tertiary']} />
          </Pressable>

          {showMenu && (
            <View style={[styles.menu, { backgroundColor: colors['bg.raised'] }]}>
              {isOwner ? (
                <Pressable style={styles.menuItem} onPress={handleDelete}>
                  <Ionicons name="trash-outline" size={16} color={colors['status.urgent']} />
                  <Text variant="body" style={{ color: colors['status.urgent'] }}>Eliminar</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.menuItem} onPress={() => { setShowMenu(false); setShowReport(true); }}>
                  <Ionicons name="flag-outline" size={16} color={colors['text.secondary']} />
                  <Text variant="body">Reportar</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* Texto */}
        {post.text ? (
          <Text variant="body" color="text.secondary" style={styles.postText}>{post.text}</Text>
        ) : null}

        {/* Acciones — stats solo si > 0 */}
        <View style={[styles.actions, { borderTopColor: colors['border.subtle'] }]}>
          <Pressable style={styles.actionBtn} onPress={() => onLike?.(post.id)} accessibilityRole="button" accessibilityLabel={isLiked ? 'Quitar like' : 'Dar like'}>
            <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={20} color={isLiked ? colors['status.urgent'] : colors['text.tertiary']} />
            {likeCount > 0 && (
              <Text variant="caption" style={{ color: isLiked ? colors['status.urgent'] : colors['text.tertiary'], marginLeft: 4 }}>
                {likeCount} {likeCount === 1 ? 'like' : 'likes'}
              </Text>
            )}
          </Pressable>

          <Pressable style={styles.actionBtn} onPress={() => setShowComments(v => !v)} accessibilityRole="button">
            <Ionicons name="chatbubble-outline" size={18} color={colors['text.tertiary']} />
            {commentCount > 0 && (
              <Text variant="caption" color="text.tertiary" style={{ marginLeft: 4 }}>
                {commentCount} {commentCount === 1 ? 'comentario' : 'comentarios'}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Comentarios expandidos */}
        {showComments && (
          <View style={[styles.commentsSection, { borderTopColor: colors['border.subtle'] }]}>
            {(post.comments ?? []).map((c, i) => (
              <View key={c.createdAt ?? i} style={styles.comment}>
                <Text variant="label" style={{ color: colors['nav.selected'] }}>{c.userName} </Text>
                <Text variant="caption" color="text.secondary" style={{ flex: 1 }}>{c.text}</Text>
              </View>
            ))}
            <View style={[styles.commentInput, { backgroundColor: colors['bg.base'] }]}>
              <TextInput
                style={{ flex: 1, color: colors['text.primary'], fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular' }}
                placeholder="Comentá…"
                placeholderTextColor={colors['text.tertiary']}
                value={commentText}
                onChangeText={setCommentText}
                onSubmitEditing={handleComment}
              />
              <Pressable onPress={handleComment} accessibilityLabel="Enviar comentario">
                <Ionicons name="send" size={18} color={colors['action.primary']} />
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default memo(PostCard);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: space[5],
    marginBottom: space[4],
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  postImage: {
    width: '100%',
    aspectRatio: 4 / 3,   // respeta relación de aspecto, no altura fija
  },
  content: { padding: space[4] },
  header:  { flexDirection: 'row', alignItems: 'center', marginBottom: space[3], position: 'relative' },
  userInfo:{ flexDirection: 'row', alignItems: 'center', flex: 1 },
  menuBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  menu: {
    position: 'absolute',
    right: 0,
    top: 36,
    borderRadius: radius.md,
    paddingVertical: space[2],
    zIndex: 100,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingHorizontal: space[4], paddingVertical: space[3] },
  postText: { marginBottom: space[3] },
  actions: {
    flexDirection: 'row',
    paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space[4],
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center' },
  commentsSection: { marginTop: space[3], paddingTop: space[3], borderTopWidth: StyleSheet.hairlineWidth },
  comment: { flexDirection: 'row', marginBottom: space[2] },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    marginTop: space[2],
    gap: space[2],
  },
});

// PostDetailModal — § 19a: detalle de publicación con tokens, tiempo relativo, stats legibles.
import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useState } from 'react';
import { Image } from 'expo-image';
import {
  Alert, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StyleSheet, TextInput, View,
} from 'react-native';
import ImageViewerModal from './ImageViewerModal';
import Avatar from './ui/Avatar';
import ReportModal from './ReportModal';
import Text from './ui/Text';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';

// "hace 2 h" / "hace 5 meses" — nunca "157d"
function timeAgo(date) {
  if (!date) return '';
  const d    = date.toDate ? date.toDate() : new Date(date);
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60)       return 'Ahora';
  if (diff < 3600)     return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400)    return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 2592000)  return `hace ${Math.floor(diff / 86400)} días`;
  if (diff < 31536000) return `hace ${Math.floor(diff / 2592000)} meses`;
  return `hace ${Math.floor(diff / 31536000)} años`;
}

function PostDetailModal({ post, visible, onClose, currentUserId, onLike, onComment, onDelete, onUserPress }) {
  const { colors } = useTheme();
  const [commentText,    setCommentText]    = useState('');
  const [showReport,     setShowReport]     = useState(false);
  const [showImageViewer,setShowImageViewer]= useState(false);
  const [showMenu,       setShowMenu]       = useState(false);

  const isLiked = post?.likes?.includes(currentUserId);
  const isOwner = post?.userId === currentUserId;
  const likeCount    = post?.likes?.length ?? 0;
  const commentCount = post?.comments?.length ?? 0;

  const handleDelete = useCallback(() => {
    setShowMenu(false);
    Alert.alert('¿Eliminar publicación?', 'Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => { onDelete?.(post.id); onClose(); } },
    ]);
  }, [post?.id, onDelete, onClose]);

  const handleComment = useCallback(() => {
    if (!commentText.trim()) return;
    onComment?.(post.id, commentText.trim());
    setCommentText('');
  }, [commentText, post?.id, onComment]);

  const handleLike = useCallback(() => onLike?.(post.id), [post?.id, onLike]);
  const handleUserPress = useCallback(() => { onClose(); onUserPress?.(post.userId); }, [post?.userId, onUserPress, onClose]);

  if (!post) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.sheet, { backgroundColor: colors['bg.raised'] }]}>

        {/* Handle */}
        <View style={[styles.handleBar, { backgroundColor: colors['border.strong'] }]} />

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Imagen — aspectRatio 4:3, no altura fija */}
          {post.image ? (
            <Pressable onPress={() => setShowImageViewer(true)} activeOpacity={0.9}>
              <Image source={{ uri: post.image }} style={styles.image} contentFit="cover" transition={200} />
            </Pressable>
          ) : null}

          <View style={styles.content}>
            {/* Header: avatar + nombre + tiempo + menú ··· */}
            <View style={styles.header}>
              <Pressable style={styles.userInfo} onPress={handleUserPress} accessibilityRole="button">
                <Avatar uri={post.userAvatar} name={post.userName} size={40} />
                <View style={{ marginLeft: space[2] }}>
                  {/* Nombre en text.primary (no violeta) */}
                  <Text variant="title" style={{ fontSize: 15 }}>{post.userName}</Text>
                  <Text variant="caption" color="text.tertiary">{timeAgo(post.createdAt)}</Text>
                </View>
              </Pressable>

              <View style={styles.headerActions}>
                {/* Menú ··· — eliminar/reportar detrás del menú */}
                <Pressable onPress={() => setShowMenu(v => !v)} style={styles.iconBtn} hitSlop={4} accessibilityLabel="Opciones">
                  <Ionicons name="ellipsis-horizontal" size={20} color={colors['text.tertiary']} />
                </Pressable>
                <Pressable onPress={onClose} style={styles.iconBtn} hitSlop={4} accessibilityLabel="Cerrar">
                  <Ionicons name="close" size={22} color={colors['text.secondary']} />
                </Pressable>
              </View>

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
            {post.text ? <Text variant="body" color="text.secondary" style={styles.postText}>{post.text}</Text> : null}

            {/* Stats — "me gusta", solo si > 0 */}
            <View style={[styles.actions, { borderTopColor: colors['border.subtle'], borderBottomColor: colors['border.subtle'] }]}>
              <Pressable style={styles.actionBtn} onPress={handleLike} accessibilityRole="button" accessibilityLabel={isLiked ? 'Quitar like' : 'Dar like'}>
                <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={22} color={isLiked ? colors['status.urgent'] : colors['text.secondary']} />
                {likeCount > 0 && (
                  <Text variant="caption" style={{ color: isLiked ? colors['status.urgent'] : colors['text.secondary'], marginLeft: space[1] }}>
                    {likeCount} {likeCount === 1 ? 'me gusta' : 'me gusta'}
                  </Text>
                )}
              </Pressable>
              <View style={styles.actionBtn}>
                <Ionicons name="chatbubble-outline" size={20} color={colors['text.secondary']} />
                {commentCount > 0 && (
                  <Text variant="caption" color="text.secondary" style={{ marginLeft: space[1] }}>
                    {commentCount} {commentCount === 1 ? 'comentario' : 'comentarios'}
                  </Text>
                )}
              </View>
            </View>

            {/* Comentarios */}
            <View style={styles.commentsSection}>
              {(post.comments ?? []).length === 0 ? (
                <Text variant="caption" color="text.tertiary" align="center" style={{ paddingVertical: space[4] }}>
                  Sé el primero en comentar
                </Text>
              ) : (
                (post.comments ?? []).map((c, i) => (
                  <View key={c.createdAt ?? i} style={styles.comment}>
                    <Pressable onPress={() => { if (c.userId) { onClose(); onUserPress?.(c.userId); } }}>
                      <Avatar uri={c.userAvatar} name={c.userName} size={30} />
                    </Pressable>
                    <View style={[styles.commentBubble, { backgroundColor: colors['bg.surface'] }]}>
                      {/* Nombre en nav.selected como enlace */}
                      <Text variant="label" style={{ color: colors['nav.selected'], marginBottom: 2 }}>{c.userName}</Text>
                      <Text variant="caption" color="text.secondary">{c.text}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        </ScrollView>

        {/* Input de comentario — § 5.1: bg.surface + botón amarillo */}
        <View style={[styles.inputRow, { backgroundColor: colors['bg.raised'], borderTopColor: colors['border.subtle'] }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors['bg.surface'], color: colors['text.primary'], borderColor: colors['border.strong'], fontFamily: 'PlusJakartaSans_400Regular' }]}
            placeholder="Comentá…"
            placeholderTextColor={colors['text.tertiary']}
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={500}
          />
          <Pressable
            onPress={handleComment}
            disabled={!commentText.trim()}
            style={[styles.sendBtn, { backgroundColor: commentText.trim() ? colors['action.primary'] : colors['bg.surface'] }]}
            accessibilityLabel="Enviar comentario"
          >
            <Ionicons name="send" size={18} color={commentText.trim() ? colors['text.onAction'] : colors['text.tertiary']} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <ReportModal visible={showReport} onClose={() => setShowReport(false)} targetType="post" targetId={post.id} />
      <ImageViewerModal uri={post.image} visible={showImageViewer} onClose={() => setShowImageViewer(false)} />
    </Modal>
  );
}

export default memo(PostDetailModal);

const styles = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:     { maxHeight: '92%', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, overflow: 'hidden' },
  handleBar: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: space[3], marginBottom: space[2] },
  image:     { width: '100%', aspectRatio: 4/3 },
  content:   { padding: space[5] },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space[4], position: 'relative' },
  userInfo:  { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerActions: { flexDirection: 'row', gap: space[1] },
  iconBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  menu: {
    position: 'absolute', right: 0, top: 40, borderRadius: radius.md,
    paddingVertical: space[2], zIndex: 100, minWidth: 140,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingHorizontal: space[4], paddingVertical: space[3] },
  postText: { marginBottom: space[4] },
  actions: {
    flexDirection: 'row',
    paddingVertical: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: space[4],
    gap: space[4],
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center' },
  commentsSection: { gap: space[3] },
  comment: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  commentBubble: { flex: 1, borderRadius: radius.md, paddingHorizontal: space[3], paddingVertical: space[2] },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space[2],
  },
  input: {
    flex: 1,
    borderRadius: radius.full,
    borderWidth: 1.5,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    fontSize: 14,
    maxHeight: 80,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
});

// ProfileScreen — "Mi mochila" (perfil propio)
// LÓGICA INTACTA: eventos, posts, follows, admin/advertiser checks.
// PRESENTACIÓN: design system v1.1 — tokens, EventRow, Avatar, UnderlineTabs.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { doc, getDoc } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import EventRow from '../components/ui/EventRow';
import { SkeletonList } from '../components/ui/Skeleton';
import Text from '../components/ui/Text';
import { UnderlineTabs } from '../components/ui/SegmentedControl';
import PostCard from '../components/PostCard';

import { auth, db } from '../config/firebase';
import { subscribeToEvents } from '../services/eventService';
import { addPostComment, deletePost, subscribeToUserPosts, togglePostLike } from '../services/postService';
import { createNotification, NOTIFICATION_TYPES } from '../services/notificationService';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import t from '../i18n/es-CR.json';

const TABS = [
  { label: t.profile.tabs.events, value: 'eventos' },
  { label: t.profile.tabs.posts,  value: 'publicaciones' },
];

export default function ProfileScreen({ navigation }) {
  const { colors } = useTheme();
  const [user,    setUser]    = useState(null);
  const [events,  setEvents]  = useState([]);
  const [posts,   setPosts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('eventos');

  const currentUser = auth.currentUser;

  useEffect(() => {
    loadUser();
    const unsubEvents = subscribeToEvents((all) => {
      setEvents(all.filter(e => e.organizerId === currentUser.uid));
    });
    let unsubPosts;
    try {
      unsubPosts = subscribeToUserPosts(currentUser.uid, setPosts);
    } catch {}

    const focusUnsub = navigation.addListener('focus', () => {
      setLoading(true);
      loadUser();
    });
    return () => {
      unsubEvents?.();
      unsubPosts?.();
      focusUnsub?.();
    };
  }, []);

  const loadUser = async () => {
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      if (snap.exists()) setUser(snap.data());
    } catch {}
    setLoading(false);
  };

  const isExpired = (e) => {
    try {
      const [d, m, y] = e.date.split('/');
      const [h, min] = (e.time || '23:59').split(':');
      return new Date(y, m - 1, d, h, min) < new Date();
    } catch { return false; }
  };

  const { active, expired } = useMemo(() => {
    const parse = e => { const [d,m,y] = e.date.split('/'); return new Date(y,m-1,d); };
    return {
      active:  events.filter(e => !isExpired(e)).sort((a,b) => parse(a)-parse(b)),
      expired: events.filter(e =>  isExpired(e)).sort((a,b) => parse(b)-parse(a)),
    };
  }, [events]);

  // ── Post handlers ──────────────────────────────────────────────────────────

  const handlePostLike = useCallback(async (postId) => {
    try {
      const { likes, ownerId, added } = await togglePostLike(postId, currentUser.uid);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes } : p));
      if (added && ownerId && ownerId !== currentUser.uid) {
        createNotification({ type: NOTIFICATION_TYPES.POST_LIKE, fromUserId: currentUser.uid, fromUserName: currentUser.displayName || currentUser.email.split('@')[0], fromUserAvatar: currentUser.photoURL || '', toUserId: ownerId, message: 'le dio like a tu publicación', postId }).catch(() => {});
      }
    } catch {}
  }, [currentUser]);

  const handlePostComment = useCallback(async (postId, text) => {
    try {
      const userName = currentUser.displayName || currentUser.email.split('@')[0];
      const userAvatar = currentUser.photoURL || '';
      const { comment, ownerId } = await addPostComment(postId, { userId: currentUser.uid, userName, userAvatar, text });
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: [...(p.comments || []), comment] } : p));
      if (ownerId && ownerId !== currentUser.uid) {
        createNotification({ type: NOTIFICATION_TYPES.POST_COMMENT, fromUserId: currentUser.uid, fromUserName: userName, fromUserAvatar: userAvatar, toUserId: ownerId, message: 'comentó en tu publicación', postId }).catch(() => {});
      }
    } catch {}
  }, [currentUser]);

  const handlePostDelete = useCallback(async (postId) => {
    try { await deletePost(postId, currentUser.uid); setPosts(prev => prev.filter(p => p.id !== postId)); } catch {}
  }, [currentUser.uid]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
        <View style={styles.header}>
          <Text variant="h2">Perfil</Text>
        </View>
        <SkeletonList count={4} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space[16] }}>

        {/* Header */}
        <View style={styles.header}>
          <Text variant="h2">Perfil</Text>
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            style={styles.headerIcon}
            accessibilityLabel={t.settings.title}
            accessibilityRole="button"
          >
            <Ionicons name="settings-outline" size={24} color={colors['text.primary']} />
          </Pressable>
        </View>

        {/* Cover */}
        <View style={[styles.cover, { backgroundColor: colors['bg.surface'] }]}>
          {user?.coverImage && (
            <Image source={{ uri: user.coverImage }} style={styles.coverImg} contentFit="cover" />
          )}
        </View>

        {/* Avatar + info */}
        <View style={styles.profileSection}>
          <View style={[styles.avatarRing, { borderColor: colors['bg.base'] }]}>
            <Avatar uri={user?.avatar} name={user?.name || currentUser.displayName} size={88} />
          </View>

          <Text variant="h2" style={styles.name}>{user?.name || 'Usuario'}</Text>
          {user?.bio && <Text variant="body" color="text.secondary" align="center" style={styles.bio}>{user.bio}</Text>}

          {/* Botón editar perfil */}
          <Button
            variant="secondary"
            size="sm"
            label={t.profile.editProfile}
            onPress={() => navigation.navigate('EditProfile')}
            style={styles.editBtn}
          />

          {/* Accesos especiales */}
          {(user?.isAdmin || user?.isAdvertiser) && (
            <View style={styles.specialRow}>
              {user?.isAdvertiser && (
                <Button
                  variant="secondary"
                  size="sm"
                  label="Centro de Anuncios"
                  leadingIcon={<Ionicons name="megaphone" size={16} color={colors['nav.selected']} />}
                  onPress={() => navigation.navigate('AdCenter')}
                />
              )}
              {user?.isAdmin && (
                <Button
                  variant="primary"
                  size="sm"
                  label="Panel Admin"
                  leadingIcon={<Ionicons name="shield-checkmark" size={16} color={colors['text.onAction']} />}
                  onPress={() => navigation.navigate('Admin')}
                />
              )}
            </View>
          )}

          {/* Invitación a anunciarse */}
          {!user?.isAdvertiser && !user?.isAdmin && (
            <Pressable
              style={[styles.advertiseBar, { backgroundColor: colors['bg.surface'], borderColor: colors['border.strong'] }]}
              onPress={() => navigation.navigate('AdvertiserRequest')}
            >
              <Ionicons name="megaphone-outline" size={16} color={colors['nav.selected']} />
              <Text variant="caption" color="nav.selected" style={{ flex: 1 }}>¿Querés publicitar en Enfiestados?</Text>
              <Ionicons name="chevron-forward" size={14} color={colors['nav.selected']} />
            </Pressable>
          )}

          {/* Stats */}
          <View style={[styles.statsRow, { borderTopColor: colors['border.subtle'], borderBottomColor: colors['border.subtle'] }]}>
            {[
              { label: 'Posts',      value: posts.length },
              { label: 'Seguidores', value: user?.followers?.length ?? 0 },
              { label: 'Siguiendo',  value: user?.following?.length  ?? 0 },
            ].map((s, i) => (
              <View key={i} style={styles.statItem}>
                <Text variant="h3">{s.value > 999 ? `${(s.value/1000).toFixed(1)}k` : s.value}</Text>
                <Text variant="caption" color="text.tertiary">{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsWrap}>
          <UnderlineTabs options={TABS} selected={tab} onSelect={setTab} />
        </View>

        {/* Contenido de tabs */}
        {tab === 'eventos' ? (
          events.length === 0 ? (
            <EmptyState
              icon={<Ionicons name="calendar-outline" size={28} color={colors['text.tertiary']} />}
              title="No has creado eventos aún"
              description="Creá tu primer evento y empezá a recibir asistentes."
              actionLabel="Crear evento"
              onAction={() => navigation.navigate('CreateEvent')}
            />
          ) : (
            <View>
              {active.length > 0 && (
                <>
                  <View style={[styles.sectionHeader, { borderBottomColor: colors['border.subtle'] }]}>
                    <View style={[styles.dot, { backgroundColor: colors['status.free'] }]} />
                    <Text variant="overline" color="text.tertiary">ACTIVOS · {active.length}</Text>
                  </View>
                  {active.map(ev => (
                    <EventRow key={ev.id} event={ev} trailing="price" onPress={() => navigation.navigate('EventDetail', { event: ev })} />
                  ))}
                </>
              )}
              {expired.length > 0 && (
                <>
                  <View style={[styles.sectionHeader, { borderBottomColor: colors['border.subtle'] }]}>
                    <View style={[styles.dot, { backgroundColor: colors['text.tertiary'] }]} />
                    <Text variant="overline" color="text.tertiary">PASADOS · {expired.length}</Text>
                  </View>
                  {expired.map(ev => (
                    <View key={ev.id} style={{ opacity: 0.55 }}>
                      <EventRow event={ev} trailing="price" onPress={() => navigation.navigate('EventDetail', { event: ev })} />
                    </View>
                  ))}
                </>
              )}
            </View>
          )
        ) : (
          <>
            <Pressable
              style={[styles.createPostBar, { backgroundColor: colors['bg.surface'], borderColor: colors['nav.selected'] }]}
              onPress={() => navigation.navigate('CreatePost')}
            >
              <Ionicons name="add-circle-outline" size={22} color={colors['nav.selected']} />
              <Text variant="label" color="nav.selected">Crear publicación</Text>
            </Pressable>
            {posts.length === 0 ? (
              <EmptyState
                icon={<Ionicons name="grid-outline" size={28} color={colors['text.tertiary']} />}
                title="Sin publicaciones"
                description="Compartí algo con tus seguidores."
              />
            ) : (
              posts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={currentUser.uid}
                  onLike={handlePostLike}
                  onComment={handlePostComment}
                  onDelete={handlePostDelete}
                  onUserPress={(uid) => { if (uid !== currentUser.uid) navigation.navigate('UserProfile', { userId: uid }); }}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[5], paddingVertical: space[4] },
  headerIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  cover:    { height: 140 },
  coverImg: { width: '100%', height: '100%' },

  profileSection: { alignItems: 'center', paddingHorizontal: space[5], marginTop: -44 },
  avatarRing: { borderWidth: 4, borderRadius: 999, marginBottom: space[3] },
  name:      { marginTop: space[2] },
  bio:       { marginTop: space[2], paddingHorizontal: space[4] },
  editBtn:   { marginTop: space[3] },
  specialRow: { flexDirection: 'row', gap: space[2], marginTop: space[3], flexWrap: 'wrap', justifyContent: 'center' },

  advertiseBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    marginTop: space[3],
    borderWidth: 1,
    gap: space[2],
    width: '100%',
  },

  statsRow: {
    flexDirection: 'row',
    marginTop: space[5],
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: space[4],
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },

  tabsWrap: { paddingHorizontal: space[5], marginTop: space[2] },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    gap: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },

  createPostBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: space[5],
    marginVertical: space[4],
    paddingVertical: space[4],
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: space[2],
  },
});

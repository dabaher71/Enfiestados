import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import UserAvatar from '../components/UserAvatar';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EventCard from '../components/EventCard';
import PostCard from '../components/PostCard';
import { auth, db } from '../config/firebase';
import { subscribeToEvents } from '../services/eventService';
import { addPostComment, deletePost, subscribeToUserPosts, togglePostLike } from '../services/postService';
import { createNotification, NOTIFICATION_TYPES } from '../services/notificationService';

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('eventos');

  const currentUser = auth.currentUser;

  useEffect(() => {
    loadUser();
    const unsubscribeEvents = loadUserEvents();
    let unsubscribePosts;
    try {
      unsubscribePosts = subscribeToUserPosts(currentUser.uid, (userPosts) => {
        setPosts(userPosts);
      });
    } catch (error) {
      console.error('Error posts:', error);
    }

    const focusUnsub = navigation.addListener('focus', () => {
      setLoading(true);
      loadUser();
    });

    return () => {
      unsubscribeEvents && unsubscribeEvents();
      unsubscribePosts && unsubscribePosts();
      focusUnsub && focusUnsub();
    };
  }, []);

  const loadUser = async () => {
    try {
      setLoading(true);
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        setUser(userDoc.data());
      }
    } catch (error) {
      console.error('Error al cargar usuario:', error);
    }
    setLoading(false);
  };

  const loadUserEvents = () => {
    return subscribeToEvents((allEvents) => {
      const userEvents = allEvents.filter(event => event.organizerId === currentUser.uid);
      setEvents(userEvents);
    });
  };

  const isExpired = (event) => {
    try {
      const [day, month, year] = event.date.split('/');
      const [hours, minutes] = (event.time || '23:59').split(':');
      return new Date(year, month - 1, day, hours, minutes) < new Date();
    } catch { return false; }
  };

  const { activeEvents, expiredEvents } = useMemo(() => {
    const active = events.filter(e => !isExpired(e))
      .sort((a, b) => {
        const parse = d => { const [dd,mm,yy] = d.date.split('/'); return new Date(yy,mm-1,dd); };
        return parse(a) - parse(b);
      });
    const expired = events.filter(e => isExpired(e))
      .sort((a, b) => {
        const parse = d => { const [dd,mm,yy] = d.date.split('/'); return new Date(yy,mm-1,dd); };
        return parse(b) - parse(a); // más reciente primero
      });
    return { activeEvents: active, expiredEvents: expired };
  }, [events]);

  const handleEventPress = useCallback((event) => {
    navigation.navigate('EventDetail', { event });
  }, [navigation]);

  const handleUserPress = useCallback((userId) => {
    if (userId !== currentUser.uid) {
      navigation.navigate('UserProfile', { userId });
    }
  }, [navigation, currentUser.uid]);

  const handlePostLike = useCallback(async (postId) => {
    try {
      const { likes, ownerId, added } = await togglePostLike(postId, currentUser.uid);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes } : p));
      if (added && ownerId && ownerId !== currentUser.uid) {
        createNotification({
          type: NOTIFICATION_TYPES.POST_LIKE,
          fromUserId: currentUser.uid,
          fromUserName: currentUser.displayName || currentUser.email.split('@')[0],
          fromUserAvatar: currentUser.photoURL || '',
          toUserId: ownerId,
          message: 'le dio like a tu publicación',
          postId,
        }).catch(() => {});
      }
    } catch (_) {}
  }, [currentUser]);

  const handlePostComment = useCallback(async (postId, text) => {
    try {
      const userName = currentUser.displayName || currentUser.email.split('@')[0];
      const userAvatar = currentUser.photoURL || '';
      const { comment, ownerId } = await addPostComment(postId, {
        userId: currentUser.uid,
        userName,
        userAvatar,
        text,
      });
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, comments: [...(p.comments || []), comment] } : p
      ));
      if (ownerId && ownerId !== currentUser.uid) {
        createNotification({
          type: NOTIFICATION_TYPES.POST_COMMENT,
          fromUserId: currentUser.uid,
          fromUserName: userName,
          fromUserAvatar: userAvatar,
          toUserId: ownerId,
          message: 'comentó en tu publicación',
          postId,
        }).catch(() => {});
      }
    } catch (_) {}
  }, [currentUser]);

  const handlePostDelete = useCallback(async (postId) => {
    try {
      await deletePost(postId, currentUser.uid);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (_) {}
  }, [currentUser.uid]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6c5ce7" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mi Perfil</Text>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="settings-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.coverContainer}>
          {user?.coverImage ? (
            <Image source={{ uri: user.coverImage }} style={styles.coverImage} />
          ) : null}
        </View>

        <View style={styles.profileSection}>
          <UserAvatar uri={user?.avatar} size={90} style={styles.avatar} />
          <Text style={styles.name}>{user?.name || 'Usuario'}</Text>
          <Text style={styles.email}>{currentUser.email}</Text>
          {user?.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

          {/* Accesos especiales */}
          {(user?.isAdmin || user?.isAdvertiser) && (
            <View style={styles.specialBtns}>
              {user?.isAdvertiser && (
                <TouchableOpacity style={styles.specialBtn} onPress={() => navigation.navigate('AdCenter')}>
                  <Ionicons name="megaphone" size={16} color="#6c5ce7" />
                  <Text style={styles.specialBtnText}>Centro de Anuncios</Text>
                </TouchableOpacity>
              )}
              {user?.isAdmin && (
                <TouchableOpacity style={[styles.specialBtn, styles.adminBtn]} onPress={() => navigation.navigate('Admin')}>
                  <Ionicons name="shield-checkmark" size={16} color="#fff" />
                  <Text style={[styles.specialBtnText, { color: '#fff' }]}>Panel Admin</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Invitación a anunciarse (solo si no es anunciante aún) */}
          {!user?.isAdvertiser && !user?.isAdmin && (
            <TouchableOpacity style={styles.advertiseInvite} onPress={() => navigation.navigate('AdvertiserRequest')}>
              <Ionicons name="megaphone-outline" size={16} color="#6c5ce7" />
              <Text style={styles.advertiseInviteText}>¿Querés publicitar en Enfiestados?</Text>
              <Ionicons name="chevron-forward" size={14} color="#6c5ce7" />
            </TouchableOpacity>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{posts.length}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{user?.followers?.length || 0}</Text>
              <Text style={styles.statLabel}>Seguidores</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{user?.following?.length || 0}</Text>
              <Text style={styles.statLabel}>Siguiendo</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabsContainer}>
          <TouchableOpacity style={[styles.tab, activeTab === 'eventos' && styles.tabActive]} onPress={() => setActiveTab('eventos')}>
            <Ionicons name="calendar" size={22} color={activeTab === 'eventos' ? '#6c5ce7' : '#888'} />
            <Text style={[styles.tabText, activeTab === 'eventos' && styles.tabTextActive]}>Eventos</Text>
            {events.length > 0 && (
              <View style={[styles.tabBadge, activeTab === 'eventos' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'eventos' && styles.tabBadgeTextActive]}>{events.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'publicaciones' && styles.tabActive]} onPress={() => setActiveTab('publicaciones')}>
            <Ionicons name="grid" size={22} color={activeTab === 'publicaciones' ? '#6c5ce7' : '#888'} />
            <Text style={[styles.tabText, activeTab === 'publicaciones' && styles.tabTextActive]}>Publicaciones</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.contentSection}>
          {activeTab === 'eventos' ? (
            events.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={50} color="#888" />
                <Text style={styles.emptyText}>No has creado eventos aún</Text>
                <TouchableOpacity style={styles.createButton} onPress={() => navigation.navigate('Create')}>
                  <Text style={styles.createButtonText}>Crear mi primer evento</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {activeEvents.length > 0 && (
                  <>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="radio-button-on" size={14} color="#00b894" />
                      <Text style={styles.sectionTitle}>Activos</Text>
                      <Text style={styles.sectionCount}>{activeEvents.length}</Text>
                    </View>
                    {activeEvents.map(event => (
                      <EventCard key={event.id} event={event} onPress={() => handleEventPress(event)} />
                    ))}
                  </>
                )}

                {expiredEvents.length > 0 && (
                  <>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="time-outline" size={14} color="#888" />
                      <Text style={[styles.sectionTitle, styles.sectionTitleMuted]}>Pasados</Text>
                      <Text style={styles.sectionCount}>{expiredEvents.length}</Text>
                    </View>
                    {expiredEvents.map(event => (
                      <View key={event.id} style={styles.expiredWrapper}>
                        <EventCard event={event} onPress={() => handleEventPress(event)} />
                        <View style={styles.expiredOverlay}>
                          <Text style={styles.expiredLabel}>Finalizado</Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </>
            )
          ) : (
            <>
              <TouchableOpacity style={styles.createPostButton} onPress={() => navigation.navigate('CreatePost')}>
                <Ionicons name="add-circle" size={24} color="#6c5ce7" />
                <Text style={styles.createPostText}>Crear publicación</Text>
              </TouchableOpacity>
              {posts.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="chatbubbles-outline" size={50} color="#888" />
                  <Text style={styles.emptyText}>No tienes publicaciones aún</Text>
                  <Text style={styles.emptySubtext}>Comparte algo con tus seguidores</Text>
                </View>
              ) : (
                posts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={currentUser.uid}
                    onLike={handlePostLike}
                    onComment={handlePostComment}
                    onDelete={handlePostDelete}
                    onUserPress={handleUserPress}
                  />
                ))
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  loadingContainer: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  headerButton: { marginLeft: 15 },
  coverContainer: { height: 150, backgroundColor: '#2d2d44' },
  coverImage: { width: '100%', height: '100%' },
  profileSection: { alignItems: 'center', paddingHorizontal: 20, marginTop: -50 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#1a1a2e', backgroundColor: '#2d2d44' },
  name: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginTop: 15 },
  email: { fontSize: 14, color: '#888', marginTop: 4 },
  bio: { fontSize: 14, color: '#aaa', textAlign: 'center', marginTop: 10, paddingHorizontal: 20 },
  statsRow: { flexDirection: 'row', marginTop: 20, paddingHorizontal: 10 },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 4 },
  tabsContainer: { flexDirection: 'row', marginTop: 25, borderBottomWidth: 1, borderBottomColor: '#2d2d44' },
  tab: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 15 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#6c5ce7' },
  tabText: { color: '#888', fontSize: 14, fontWeight: '600', marginLeft: 8 },
  tabTextActive: { color: '#fff' },
  contentSection: { paddingVertical: 15, paddingBottom: 100 },
  createPostButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2d2d44', marginHorizontal: 15, marginBottom: 15, paddingVertical: 15, borderRadius: 12, borderWidth: 1, borderColor: '#6c5ce7', borderStyle: 'dashed' },
  createPostText: { color: '#6c5ce7', fontSize: 15, fontWeight: '600', marginLeft: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 50 },
  emptyText: { color: '#888', fontSize: 16, marginTop: 15 },
  emptySubtext: { color: '#666', fontSize: 14, marginTop: 5 },
  createButton: { backgroundColor: '#6c5ce7', paddingHorizontal: 25, paddingVertical: 12, borderRadius: 25, marginTop: 20 },
  createButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, gap: 6 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#fff', flex: 1 },
  sectionTitleMuted: { color: '#888' },
  sectionCount: { fontSize: 13, color: '#888', fontWeight: '600' },
  expiredWrapper: { position: 'relative' },
  expiredOverlay: { position: 'absolute', top: 10, left: 20, right: 20, bottom: 10, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' },
  expiredLabel: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 1, opacity: 0.9 },
  specialBtns: { flexDirection: 'row', gap: 10, marginBottom: 12, flexWrap: 'wrap' },
  specialBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#2d2d44', borderWidth: 1, borderColor: '#6c5ce7', gap: 6 },
  adminBtn: { backgroundColor: '#6c5ce7', borderColor: '#6c5ce7' },
  specialBtnText: { color: '#6c5ce7', fontWeight: '700', fontSize: 13 },
  tabBadge: { backgroundColor: '#3d3d54', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5, marginLeft: 6 },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabBadgeText: { color: '#888', fontSize: 11, fontWeight: '700' },
  tabBadgeTextActive: { color: '#fff' },
  advertiseInvite: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2d2d44', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 16, marginBottom: 14, gap: 8 },
  advertiseInviteText: { color: '#6c5ce7', fontSize: 13, flex: 1 },
});
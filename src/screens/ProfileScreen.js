// ProfileScreen — "Mi mochila" (perfil propio)
// FIX_ROUND_1 § 5: stats Voy/Guardados/Seguidores, sin banner publicidad,
// nombre con @handle + ciudad, tabs Organizo/Publicaciones.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import EventRow from '../components/ui/EventRow';
import { SkeletonList } from '../components/ui/Skeleton';
import Text from '../components/ui/Text';
import { SegmentedControl } from '../components/ui/SegmentedControl';  // § 4.3: reemplaza UnderlineTabs
import PostCard from '../components/PostCard';

import { auth, db } from '../config/firebase';
import { subscribeToEvents } from '../services/eventService';
import { fetchExternalEventsByIds } from '../services/externalEventService';
import { addPostComment, deletePost, subscribeToUserPosts, togglePostLike } from '../services/postService';
import { createNotification, NOTIFICATION_TYPES } from '../services/notificationService';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { formatEventDate } from '../lib/format';
import t from '../i18n/es-CR.json';

const TABS = [
  { label: 'Organizo',       value: 'eventos' },
  { label: 'Publicaciones',  value: 'publicaciones' },
  { label: 'Guardados',      value: 'guardados' },   // § 4.3: tercera pestaña
];

export default function ProfileScreen({ navigation }) {
  const { colors } = useTheme();
  const [user,           setUser]           = useState(null);
  const [events,         setEvents]         = useState([]);
  const [posts,          setPosts]          = useState([]);
  const [attendingEvents,setAttendingEvents]= useState([]);
  const [savedEvents,    setSavedEvents]    = useState([]);
  const [savedExternal,  setSavedExternal]  = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [tab,            setTab]            = useState('eventos');

  const currentUser = auth.currentUser;

  useEffect(() => {
    loadUser();

    // Eventos que organizó el usuario
    const unsubEvents = subscribeToEvents(all => {
      setEvents(all.filter(e => e.organizerId === currentUser.uid));
    });

    // Posts del usuario
    let unsubPosts;
    try { unsubPosts = subscribeToUserPosts(currentUser.uid, setPosts); } catch {}

    // Eventos a los que el usuario va ("Voy"), en tiempo real
    const unsubAttending = onSnapshot(
      query(collection(db, 'events'), where('attendees', 'array-contains', currentUser.uid)),
      snap => setAttendingEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );

    // Eventos guardados ("Guardados"), en tiempo real
    const unsubSaved = onSnapshot(
      query(collection(db, 'events'), where('savedBy', 'array-contains', currentUser.uid)),
      snap => setSavedEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );

    // Eventos importados guardados — el estado vive en users/{uid}.savedExternalIds
    const unsubSavedExternal = onSnapshot(doc(db, 'users', currentUser.uid), async snap => {
      const ids = snap.data()?.savedExternalIds || [];
      if (ids.length === 0) { setSavedExternal([]); return; }
      try { setSavedExternal(await fetchExternalEventsByIds(ids)); } catch { setSavedExternal([]); }
    }, () => {});

    const focusUnsub = navigation.addListener('focus', () => { setLoading(true); loadUser(); });

    return () => {
      unsubEvents?.();
      unsubPosts?.();
      unsubAttending?.();
      unsubSaved?.();
      unsubSavedExternal?.();
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

  const isExpired = e => {
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

  // § 4.4 — próximo evento al que el usuario va, para la tarjeta "Tu próximo plan"
  const nextPlan = useMemo(() => {
    const parse = e => { const [d,m,y] = e.date.split('/'); return new Date(y,m-1,d); };
    const upcoming = attendingEvents.filter(e => e.date && !isExpired(e)).sort((a,b) => parse(a)-parse(b));
    return upcoming[0] ?? null;
  }, [attendingEvents]);

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

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
        <View style={styles.topBar}>
          <Text variant="h2">Perfil</Text>
        </View>
        <SkeletonList count={4} />
      </SafeAreaView>
    );
  }

  // Handle del usuario (primera parte del email o displayName como slug)
  const handle = user?.handle
    || (currentUser.displayName?.toLowerCase().replace(/\s+/g, '') )
    || currentUser.email?.split('@')[0];

  const followerCount = user?.followers?.length ?? 0;

  const STATS = [
    { label: 'Voy',       value: attendingEvents.length, onPress: () => navigation.navigate('MyPlans') },
    { label: 'Guardados', value: savedEvents.length + savedExternal.length, onPress: () => navigation.navigate('MyPlans') },
    { label: 'Seguidores',value: followerCount,           onPress: () => {} },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space[16] + 80 }}>

        {/* ── TOP BAR: título + settings ─────────────────────────────── */}
        <View style={styles.topBar}>
          <Text variant="h2">Perfil</Text>
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            style={styles.iconBtn}
            accessibilityLabel="Configuración"
            accessibilityRole="button"
          >
            <Ionicons name="settings-outline" size={24} color={colors['text.primary']} />
          </Pressable>
        </View>

        {/* ── PORTADA 150px — § 4.1: sin banda sólida, solo foto */}
        <View style={[styles.cover, { backgroundColor: colors['bg.surface'] }]}>
          {user?.coverImage ? (
            <Image source={{ uri: user.coverImage }} style={styles.coverImg} contentFit="cover" />
          ) : null}
          {/* Overlay semitransparente suave en la base (no banda sólida) */}
          <View style={styles.coverOverlay} />
        </View>

        {/* ── AVATAR superpuesto ────────────────────────────────────── */}
        <View style={styles.profileSection}>
          <Pressable
            onPress={() => navigation.navigate('UserProfile', { userId: currentUser.uid })}
            style={[styles.avatarRing, { borderColor: colors['bg.base'] }]}
            accessibilityRole="button"
            accessibilityLabel="Ver perfil público"
          >
            <Avatar uri={user?.avatar} name={user?.name || currentUser.displayName} size={88} />
          </Pressable>

          {/* Nombre en Bricolage h2 */}
          <Text style={[styles.name, { color: colors['text.primary'], fontFamily: 'BricolageGrotesque_700Bold' }]}>
            {user?.name || 'Usuario'}
          </Text>

          {/* @handle · Ciudad */}
          <Text variant="caption" color="text.tertiary" style={styles.handle}>
            @{handle}{user?.location ? ` · ${user.location}` : ''}
          </Text>

          {/* Bio: si no hay bio en perfil propio → enlace "Agregá una bio" */}
          {user?.bio ? (
            <Text variant="body" color="text.secondary" align="center" style={styles.bio}>{user.bio}</Text>
          ) : (
            <Pressable onPress={() => navigation.navigate('EditProfile', { user: null })} style={{ marginTop: space[2] }}>
              <Text variant="caption" color="link">Agregá una bio</Text>
            </Pressable>
          )}

          {/* Acciones en UNA sola fila (§ 4.2): [Editar flex:1] [Herramientas flex:1] [⤴ 50×50] */}
          <View style={styles.actionsRow}>
            <Button
              variant="secondary"
              size="sm"
              label="Editar perfil"
              onPress={() => navigation.navigate('EditProfile', { user: null })}
              style={{ flex: 1 }}
            />
            <Button
              variant="secondary"
              size="sm"
              label="Herramientas"
              onPress={() => navigation.navigate('OrganizerPanel')}
              style={{ flex: 1 }}
            />
            <Pressable
              style={[styles.shareBtn, { backgroundColor: colors['bg.surface'] }]}
              onPress={() => Share.share({ message: `Seguime en Enfiestados: @${handle}` }).catch(() => {})}
              accessibilityLabel="Compartir perfil"
            >
              <Ionicons name="share-outline" size={20} color={colors['text.primary']} />
            </Pressable>
          </View>

          {/* Accesos especiales solo para admin */}
          {user?.isAdmin && (
            <View style={styles.specialRow}>
              <Button variant="primary" size="sm" label="Panel Admin" leadingIcon={<Ionicons name="shield-checkmark" size={14} color={colors['text.onAction']} />} onPress={() => navigation.navigate('Admin')} />
            </View>
          )}

          {/* § 4.4 — Tu próximo plan: tarjeta boleto, va debajo de las acciones */}
          {nextPlan && (
            <View style={styles.nextPlanWrap}>
              <Text variant="overline" color="text.tertiary" style={styles.nextPlanLabel}>Tu próximo plan</Text>
              <Pressable
                onPress={() => navigation.navigate('EventDetail', { event: nextPlan })}
                style={({ pressed }) => [
                  styles.nextPlanCard,
                  { backgroundColor: colors['action.primary'], opacity: pressed ? 0.92 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Ver tu próximo plan: ${nextPlan.title}`}
              >
                <View style={styles.nextPlanRow}>
                  <View style={[styles.nextPlanThumb, { backgroundColor: colors['bg.surface'] }]}>
                    {(nextPlan.imageUrl || nextPlan.image) ? (
                      <Image source={{ uri: nextPlan.imageUrl || nextPlan.image }} style={styles.nextPlanThumbImg} contentFit="cover" />
                    ) : null}
                  </View>
                  <View style={styles.nextPlanInfo}>
                    <Text variant="overline" color="text.onAction" numberOfLines={1} style={{ opacity: 0.72 }}>
                      {formatEventDate(nextPlan.date, nextPlan.time)}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 19, lineHeight: 23, fontFamily: 'BricolageGrotesque_700Bold', color: colors['text.onAction'] }}
                    >
                      {nextPlan.title}
                    </Text>
                    {(nextPlan.location?.name || nextPlan.locationText) ? (
                      <Text variant="label" color="text.onAction" numberOfLines={1} style={{ opacity: 0.75 }}>
                        {nextPlan.location?.name ?? nextPlan.locationText}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.nextPlanDivider}>
                  <View style={[styles.nextPlanNotch, styles.nextPlanNotchLeft, { backgroundColor: colors['bg.base'] }]} />
                  <View style={[styles.nextPlanNotch, styles.nextPlanNotchRight, { backgroundColor: colors['bg.base'] }]} />
                </View>

                <View style={styles.nextPlanFooter}>
                  <Text variant="label" color="text.onAction">Vas a ir</Text>
                  <View style={[styles.nextPlanCta, { backgroundColor: colors['bg.base'] }]}>
                    <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors['action.primary'] }}>Ver</Text>
                  </View>
                </View>
              </Pressable>
            </View>
          )}

          {/* Stats: Voy · Guardados · Seguidores (tocables) */}
          <View style={[styles.statsRow, { borderTopColor: colors['border.subtle'], borderBottomColor: colors['border.subtle'] }]}>
            {STATS.map((s, i) => (
              <Pressable key={i} style={styles.statItem} onPress={s.onPress} accessibilityRole="button">
                <Text style={{ fontSize: 22, fontFamily: 'BricolageGrotesque_700Bold', color: colors['text.primary'] }}>
                  {s.value > 999 ? `${(s.value / 1000).toFixed(1)}k` : s.value}
                </Text>
                <Text variant="caption" color="text.tertiary">{s.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── TABS: SegmentedControl (§ 4.3): Organizo | Publicaciones | Guardados */}
        <View style={styles.tabsWrap}>
          <SegmentedControl options={TABS} selected={tab} onSelect={setTab} />
        </View>

        {/* ── CONTENIDO ─────────────────────────────────────────────── */}
        {tab === 'eventos' ? (
          events.length === 0 ? (
            <EmptyState
              icon={<Ionicons name="calendar-outline" size={28} color={colors['text.tertiary']} />}
              title="No organizaste eventos aún"
              description="Creá tu primer evento y empezá a recibir asistentes."
              actionLabel="Crear evento"
              onAction={() => navigation.navigate('CreateEvent')}
            />
          ) : (
            <>
              {active.length > 0 && (
                <>
                  <View style={[styles.sectionHeader, { borderBottomColor: colors['border.subtle'] }]}>
                    <View style={[styles.dot, { backgroundColor: colors['status.free'] }]} />
                    <Text variant="overline" color="text.tertiary">ACTIVOS · {active.length}</Text>
                  </View>
                  {active.map(ev => (
                    <EventRow key={ev.id} event={ev} trailing="auto" onPress={() => navigation.navigate('EventDetail', { event: ev })} />
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
                    <View key={ev.id} style={{ opacity: 0.5 }}>
                      <EventRow event={ev} trailing="auto" onPress={() => navigation.navigate('EventDetail', { event: ev })} />
                    </View>
                  ))}
                </>
              )}
            </>
          )
        ) : tab === 'publicaciones' ? (
          /* ── PUBLICACIONES ──────────────────────────────────────── */
          <>
            <Pressable
              style={[styles.createPostBar, { backgroundColor: colors['bg.surface'], borderColor: colors['nav.selected'] }]}
              onPress={() => navigation.navigate('CreatePost')}
              accessibilityRole="button"
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
                  onUserPress={uid => { if (uid !== currentUser.uid) navigation.navigate('UserProfile', { userId: uid }); }}
                />
              ))
            )}
          </>
        ) : (
          /* ── GUARDADOS (§ 4.3) ─────────────────────────────────── */
          savedEvents.length === 0 && savedExternal.length === 0 ? (
            <EmptyState
              icon={<Ionicons name="bookmark-outline" size={28} color={colors['text.tertiary']} />}
              title="Sin guardados todavía"
              description="Guardá los planes que te gusten y aparecen acá con recordatorio."
              actionLabel="Explorar eventos"
              onAction={() => navigation.navigate('Explore')}
            />
          ) : (
            [...savedEvents, ...savedExternal].map(ev => (
              <EventRow
                key={ev.id}
                event={ev}
                trailing="auto"
                onPress={() => navigation.navigate(
                  ev._isExternal ? 'ExternalEventDetail' : 'EventDetail',
                  { event: ev }
                )}
              />
            ))
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[5],
    paddingVertical: space[4],
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  // Portada — § 4.1: overlay semitransparente, NO banda sólida
  cover:        { height: 150, position: 'relative' },
  coverImg:     { width: '100%', height: '100%' },
  coverOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 80,
    backgroundColor: 'rgba(0,0,0,0.08)',  // muy suave, no banda
  },

  // Perfil
  profileSection: { alignItems: 'center', paddingHorizontal: space[5], marginTop: -44 },
  avatarRing:     { borderWidth: 4, borderRadius: 999, marginBottom: space[3] },
  name:           { fontSize: 26, lineHeight: 30, marginTop: space[2], textAlign: 'center' },
  handle:         { marginTop: space[1] },
  bio:            { marginTop: space[2], paddingHorizontal: space[4] },

  actionsRow: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[4],
    width: '100%',
    alignItems: 'center',
  },
  shareBtn: {
    width: 48,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  specialRow: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[3],
    flexWrap: 'wrap',
    justifyContent: 'center',
  },

  // § 4.4 — Tu próximo plan (tarjeta boleto)
  nextPlanWrap:  { width: '100%', marginTop: space[5], gap: space[2] },
  nextPlanLabel: { alignSelf: 'flex-start' },
  nextPlanCard: {
    width: '100%',
    borderRadius: radius.lg,
    padding: space[4],
    gap: space[3],
    overflow: 'hidden',
  },
  nextPlanRow:  { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  nextPlanThumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    overflow: 'hidden',
    flexShrink: 0,
  },
  nextPlanThumbImg: { width: '100%', height: '100%' },
  nextPlanInfo: { flex: 1, gap: 2, alignItems: 'flex-start' },
  nextPlanDivider: { height: 1, backgroundColor: 'rgba(23,19,31,0.18)' },
  nextPlanNotch: {
    position: 'absolute',
    top: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  nextPlanNotchLeft:  { left: -space[4] - 8 },
  nextPlanNotchRight: { right: -space[4] - 8 },
  nextPlanFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextPlanCta: {
    height: 38,
    paddingHorizontal: space[3] + 3,
    borderRadius: radius.md - 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statsRow: {
    flexDirection: 'row',
    marginTop: space[5],
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: space[4],
  },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },

  tabsWrap: { paddingHorizontal: space[5], marginTop: space[3] },

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

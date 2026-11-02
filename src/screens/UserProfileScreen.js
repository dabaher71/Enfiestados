// UserProfileScreen — Perfil público de otro usuario
// LÓGICA INTACTA: follow/unfollow, solicitudes, bloqueo, report, eventos del organizador.
// PRESENTACIÓN: design system v1.1 — Avatar, EventRow, Button, EmptyState, tokens.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { arrayRemove, arrayUnion, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ReportModal from '../components/ReportModal';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import EventRow from '../components/ui/EventRow';
import { SkeletonList } from '../components/ui/Skeleton';
import Text from '../components/ui/Text';

import { auth, db } from '../config/firebase';
import useBlockedUsers from '../hooks/useBlockedUsers';
import { blockUser, unblockUser } from '../services/blockService';
import { getOrCreateChat } from '../services/chatService';
import { subscribeToOrganizerEvents } from '../services/eventService';
import { createNotification, NOTIFICATION_TYPES } from '../services/notificationService';
import { requireAccount } from '../lib/requireAccount';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { useTranslation } from 'react-i18next';

export default function UserProfileScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { userId } = route.params;

  if (!userId || typeof userId !== 'string' || userId.length < 4) {
    navigation.goBack();
    return null;
  }

  const [user,             setUser]             = useState(null);
  const [events,           setEvents]           = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [isFollowing,      setIsFollowing]      = useState(false);
  const [hasPending,       setHasPending]       = useState(false);
  const [showReport,       setShowReport]       = useState(false);

  // Se derivan de la colección blocks en tiempo real: ya no se leen del doc
  // ajeno (donde la lista de bloqueados era pública).
  const { blockedByMe, blockedMe } = useBlockedUsers();
  const isBlocked     = blockedByMe.has(userId);
  const theyBlockedMe = blockedMe.has(userId);

  const currentUserId  = auth.currentUser?.uid;
  const isOwnProfile   = currentUserId === userId;

  useEffect(() => { loadUser(); }, [userId]);

  // Eventos del perfil según lo que este usuario puede ver: si el perfil es
  // privado y lo sigo, los que me incluyen en viewers; si no, solo los
  // públicos (ver subscribeToOrganizerEvents). Antes leía la primera página
  // del feed general y filtraba acá, con lo que faltaban eventos.
  const followsPrivate = user?.perfilPublico === false && isFollowing;
  useEffect(() => {
    if (!user && !isOwnProfile) return;
    return subscribeToOrganizerEvents(userId, currentUserId, { followsPrivate }, setEvents);
  }, [userId, currentUserId, isOwnProfile, followsPrivate, !!user]);

  const loadUser = async () => {
    try {
      const snap = await getDoc(doc(db, 'users', userId));
      if (snap.exists()) {
        const data = snap.data();
        setUser(data);
        setIsFollowing(data.followers?.includes(currentUserId) || false);
        setHasPending(data.followRequests?.includes(currentUserId) || false);
      }
    } catch {}
    setLoading(false);
  };

  const handleFollow = async () => {
    if (!requireAccount(navigation, t('userProfile.needAccountFollow'))) return;
    try {
      const userRef    = doc(db, 'users', userId);
      const currentRef = doc(db, 'users', currentUserId);
      const fromName   = auth.currentUser.displayName || auth.currentUser.email.split('@')[0];
      const fromAvatar = auth.currentUser.photoURL || '';

      if (isFollowing) {
        await updateDoc(userRef,    { followers: arrayRemove(currentUserId) });
        await updateDoc(currentRef, { following: arrayRemove(userId) });
        setUser(prev => ({ ...prev, followers: prev.followers.filter(id => id !== currentUserId) }));
        setIsFollowing(false);
      } else if (hasPending) {
        await updateDoc(userRef, { followRequests: arrayRemove(currentUserId) });
        setHasPending(false);
      } else if (user?.perfilPublico === false) {
        await updateDoc(userRef, { followRequests: arrayUnion(currentUserId) });
        setHasPending(true);
        await createNotification({ type: NOTIFICATION_TYPES.FOLLOW_REQUEST, fromUserId: currentUserId, fromUserName: fromName, fromUserAvatar: fromAvatar, toUserId: userId, message: 'quiere seguirte' });
      } else {
        await updateDoc(userRef,    { followers: arrayUnion(currentUserId) });
        await updateDoc(currentRef, { following: arrayUnion(userId) });
        setUser(prev => ({ ...prev, followers: [...(prev.followers || []), currentUserId] }));
        setIsFollowing(true);
        await createNotification({ type: NOTIFICATION_TYPES.FOLLOW, fromUserId: currentUserId, fromUserName: fromName, fromUserAvatar: fromAvatar, toUserId: userId, message: 'empezó a seguirte' });
      }
    } catch {}
  };

  const handleMessage = async () => {
    if (!requireAccount(navigation, t('userProfile.needAccountMessage'))) return;
    if (isBlocked || theyBlockedMe) return;
    try {
      const chat = await getOrCreateChat(currentUserId, userId);
      navigation.navigate('ChatDetail', { chatId: chat.id, otherUserId: userId, otherUserName: user.name, otherUserAvatar: user.avatar });
    } catch {}
  };

  const handleBlock = useCallback(() => {
    const action = isBlocked ? t('userProfile.unblock') : t('userProfile.block');
    const msg    = isBlocked
      ? t('userProfile.unblockMsg', { name: user?.name })
      : t('userProfile.blockMsg', { name: user?.name });
    Alert.alert(action, msg, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: action, style: isBlocked ? 'default' : 'destructive', onPress: async () => {
        try {
          const myRef = doc(db, 'users', currentUserId);
          if (isBlocked) {
            await unblockUser(currentUserId, userId);
          } else {
            await blockUser(currentUserId, userId);
            await updateDoc(myRef, { following: arrayRemove(userId), followers: arrayRemove(userId) });
            // En el doc ajeno solo se puede mover el propio uid y de a un
            // campo (regla de users, rama b): me saco de sus followers. Su
            // `following` queda con una entrada obsoleta, que es inofensiva
            // porque el filtro de bloqueo ya lo esconde en ambos sentidos.
            await updateDoc(doc(db, 'users', userId), { followers: arrayRemove(currentUserId) });
            setIsFollowing(false); setHasPending(false);
          }
        } catch { Alert.alert(t('common.error'), t('userProfile.actionError')); }
      }},
    ]);
  }, [isBlocked, userId, currentUserId, user, t]);

  const { active, expired } = useMemo(() => {
    const parse = e => { const [d,m,y] = e.date.split('/'); return new Date(y,m-1,d); };
    const isExp = e => { try { const [d,m,y]=e.date.split('/'); const [h,mi]=(e.time||'23:59').split(':'); return new Date(y,m-1,d,h,mi)<new Date(); } catch { return false; } };
    return {
      active:  events.filter(e => !isExp(e)).sort((a,b) => parse(a)-parse(b)),
      expired: events.filter(e =>  isExp(e)).sort((a,b) => parse(b)-parse(a)),
    };
  }, [events]);

  const followLabel  = isFollowing ? t('userProfile.following') : hasPending ? t('userProfile.requested') : t('userProfile.follow');
  const followVariant = isFollowing || hasPending ? 'secondary' : 'primary';
  const blockedEitherWay = isBlocked || theyBlockedMe;
  const canView = !blockedEitherWay && (isOwnProfile || isFollowing || user?.perfilPublico !== false);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
        <SkeletonList count={5} />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
        <EmptyState
          icon={<Ionicons name="person-outline" size={28} color={colors['text.tertiary']} />}
          title={t('userProfile.notFound')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space[16] }}>
        {/* Back button flotante */}
        <View style={styles.backWrap}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
            hitSlop={2}
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
        </View>

        {/* Cover */}
        <View style={[styles.cover, { backgroundColor: colors['bg.surface'] }]}>
          {user.coverImage && <Image source={{ uri: user.coverImage }} style={styles.coverImg} contentFit="cover" />}
        </View>

        {/* Info */}
        <View style={[styles.info, { borderBottomColor: colors['border.subtle'] }]}>
          <View style={[styles.avatarRing, { borderColor: colors['bg.base'] }]}>
            <Avatar uri={user.avatar} name={user.name} size={88} />
          </View>

          <View style={styles.nameRow}>
            <Text variant="h2">{user.name}</Text>
            {user.perfilPublico === false && (
              <Ionicons name="lock-closed" size={16} color={colors['text.tertiary']} style={{ marginLeft: space[2] }} />
            )}
          </View>
          {user.bio && <Text variant="body" color="text.secondary" align="center" style={styles.bio}>{user.bio}</Text>}

          {/* Stats */}
          <View style={[styles.statsRow, { borderTopColor: colors['border.subtle'], borderBottomColor: colors['border.subtle'] }]}>
            {[
              { label: t('userProfile.events'), value: canView ? events.length : '-' },
              { label: t('profile.statFollowers'), value: user.followers?.length ?? 0 },
              { label: t('userProfile.following'), value: user.following?.length  ?? 0 },
            ].map((s, i) => (
              <View key={i} style={styles.stat}>
                <Text variant="h3">{s.value}</Text>
                <Text variant="caption" color="text.tertiary">{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Acciones */}
          {!isOwnProfile && (
            <View style={styles.actions}>
              {!isBlocked && !theyBlockedMe && (
                <>
                  <Button variant={followVariant} size="md" label={followLabel} onPress={handleFollow} style={{ flex: 1 }} />
                  <Button variant="secondary" size="icon" leadingIcon={<Ionicons name="chatbubble-outline" size={20} color={colors['text.primary']} />} onPress={handleMessage} accessibilityLabel={t('userProfile.sendMessage')} />
                </>
              )}
              <Button
                variant="secondary"
                size="icon"
                leadingIcon={<Ionicons name={isBlocked ? 'ban-outline' : 'ban'} size={20} color={isBlocked ? colors['text.tertiary'] : colors['status.urgent']} />}
                onPress={handleBlock}
                accessibilityLabel={isBlocked ? t('userProfile.unblock') : t('userProfile.block')}
              />
              <Button
                variant="secondary"
                size="icon"
                leadingIcon={<Ionicons name="flag-outline" size={20} color={colors['text.tertiary']} />}
                onPress={() => setShowReport(true)}
                accessibilityLabel={t('common.report')}
              />
            </View>
          )}
          {theyBlockedMe && (
            <Text variant="caption" color="text.tertiary" align="center" style={{ marginTop: space[3] }}>
              {t('userProfile.cantInteract')}
            </Text>
          )}
        </View>

        {/* Contenido */}
        {canView ? (
          events.length === 0 ? (
            <EmptyState
              icon={<Ionicons name="calendar-outline" size={28} color={colors['text.tertiary']} />}
              title={t('userProfile.noEvents')}
            />
          ) : (
            <>
              {active.length > 0 && (
                <>
                  <View style={[styles.sectionHead, { borderBottomColor: colors['border.subtle'] }]}>
                    <View style={[styles.dot, { backgroundColor: colors['status.free'] }]} />
                    <Text variant="overline" color="text.tertiary">{t('profile.activeCount', { count: active.length })}</Text>
                  </View>
                  {active.map(ev => <EventRow key={ev.id} event={ev} trailing="price" onPress={() => navigation.navigate('EventDetail', { event: ev })} />)}
                </>
              )}
              {expired.length > 0 && (
                <>
                  <View style={[styles.sectionHead, { borderBottomColor: colors['border.subtle'] }]}>
                    <View style={[styles.dot, { backgroundColor: colors['text.tertiary'] }]} />
                    <Text variant="overline" color="text.tertiary">{t('profile.pastCount', { count: expired.length })}</Text>
                  </View>
                  {expired.map(ev => (
                    <View key={ev.id} style={{ opacity: 0.5 }}>
                      <EventRow event={ev} trailing="price" onPress={() => navigation.navigate('EventDetail', { event: ev })} />
                    </View>
                  ))}
                </>
              )}
            </>
          )
        ) : blockedEitherWay ? (
          <EmptyState
            icon={<Ionicons name="ban-outline" size={28} color={colors['text.tertiary']} />}
            title={t('userProfile.unavailable')}
            description={t('userProfile.unavailableDesc')}
          />
        ) : (
          <EmptyState
            icon={<Ionicons name="lock-closed-outline" size={28} color={colors['nav.selected']} />}
            title={t('userProfile.privateTitle')}
            description={t('userProfile.privateDesc')}
            actionLabel={t('userProfile.follow')}
            onAction={handleFollow}
          />
        )}
      </ScrollView>
      <ReportModal visible={showReport} onClose={() => setShowReport(false)} targetType="user" targetId={userId} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  backWrap: { position: 'absolute', top: space[3], left: space[3], zIndex: 10 },
  backBtn:  { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  cover:    { height: 140 },
  coverImg: { width: '100%', height: '100%' },

  info:       { alignItems: 'center', paddingHorizontal: space[5], marginTop: -44, paddingBottom: space[4] },
  avatarRing: { borderWidth: 4, borderRadius: 999, marginBottom: space[3] },
  nameRow:    { flexDirection: 'row', alignItems: 'center', marginTop: space[2] },
  bio:        { marginTop: space[2], paddingHorizontal: space[4] },

  statsRow: {
    flexDirection: 'row',
    width: '100%',
    marginVertical: space[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: space[4],
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },

  actions: { flexDirection: 'row', gap: space[2], flexWrap: 'wrap' },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    gap: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

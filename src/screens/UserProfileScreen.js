import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import UserAvatar from '../components/UserAvatar';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { subscribeToEvents } from '../services/eventService';
import { createNotification, NOTIFICATION_TYPES } from '../services/notificationService';
import { getOrCreateChat } from '../services/chatService';
import ReportModal from '../components/ReportModal';
import EventCard from '../components/EventCard';

export default function UserProfileScreen({ route, navigation }) {
  const { userId } = route.params;
  // sanity check: si no llega un userId válido, volver atrás
  if (!userId || typeof userId !== 'string' || userId.length < 4) {
    navigation.goBack();
    return null;
  }
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showReport, setShowReport] = useState(false);
  
  const currentUserId = auth.currentUser?.uid;
  const isOwnProfile = currentUserId === userId;

  useEffect(() => {
    loadUser();
    const unsubscribe = loadUserEvents();
    return () => unsubscribe && unsubscribe();
  }, [userId]);

  const loadUser = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUser(userData);
        setIsFollowing(userData.followers?.includes(currentUserId) || false);
        setHasPendingRequest(userData.followRequests?.includes(currentUserId) || false);
        // Verificar si el usuario actual lo tiene bloqueado
        const myDoc = await getDoc(doc(db, 'users', currentUserId));
        setIsBlocked(myDoc.data()?.usuariosBloqueados?.includes(userId) || false);
      }
    } catch (error) {
      console.error('Error al cargar usuario:', error);
    }
    setLoading(false);
  };

  const loadUserEvents = () => {
    const unsubscribe = subscribeToEvents((allEvents) => {
      const userEvents = allEvents.filter(event => event.organizerId === userId);
      setEvents(userEvents);
    });
    return unsubscribe;
  };

  const handleFollow = async () => {
    try {
      const userRef = doc(db, 'users', userId);
      const currentUserRef = doc(db, 'users', currentUserId);

      if (isFollowing) {
        // Dejar de seguir
        await updateDoc(userRef, { followers: arrayRemove(currentUserId) });
        await updateDoc(currentUserRef, { following: arrayRemove(userId) });
        setUser(prev => ({ ...prev, followers: prev.followers.filter(id => id !== currentUserId) }));
        setIsFollowing(false);
      } else if (hasPendingRequest) {
        // Cancelar solicitud
        await updateDoc(userRef, { followRequests: arrayRemove(currentUserId) });
        setHasPendingRequest(false);
        Alert.alert('Solicitud cancelada', 'Has cancelado tu solicitud de seguimiento');
      } else if (user.perfilPublico === false) {
        // Perfil privado - enviar solicitud
        await updateDoc(userRef, { followRequests: arrayUnion(currentUserId) });
        setHasPendingRequest(true);
        
        await createNotification({
          type: NOTIFICATION_TYPES.FOLLOW_REQUEST,
          fromUserId: currentUserId,
          fromUserName: auth.currentUser.displayName || auth.currentUser.email.split('@')[0],
          fromUserAvatar: auth.currentUser.photoURL || '',
          toUserId: userId,
          message: 'quiere seguirte',
        });
        
        Alert.alert('Solicitud enviada', 'Tu solicitud de seguimiento ha sido enviada');
      } else {
        // Perfil publico - seguir directamente
        await updateDoc(userRef, { followers: arrayUnion(currentUserId) });
        await updateDoc(currentUserRef, { following: arrayUnion(userId) });
        setUser(prev => ({ ...prev, followers: [...(prev.followers || []), currentUserId] }));
        setIsFollowing(true);

        await createNotification({
          type: NOTIFICATION_TYPES.FOLLOW,
          fromUserId: currentUserId,
          fromUserName: auth.currentUser.displayName || auth.currentUser.email.split('@')[0],
          fromUserAvatar: auth.currentUser.photoURL || '',
          toUserId: userId,
          message: 'comenzo a seguirte',
        });
      }
    } catch (error) {
      console.error('Error al seguir/dejar de seguir:', error);
    }
  };

  const handleMessage = async () => {
    try {
      const chat = await getOrCreateChat(currentUserId, userId);
      navigation.navigate('ChatDetail', {
        chatId: chat.id,
        otherUserId: userId,
        otherUserName: user.name,
        otherUserAvatar: user.avatar,
      });
    } catch (error) {
      console.error('Error al crear chat:', error);
    }
  };

  const handleBlock = useCallback(() => {
    const action = isBlocked ? 'Desbloquear' : 'Bloquear';
    const message = isBlocked
      ? `¿Desbloquear a ${user?.name}? Podrá volver a seguirte y ver tu perfil.`
      : `¿Bloquear a ${user?.name}? No podrá ver tu perfil ni interactuar contigo.`;
    Alert.alert(action, message, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: action,
        style: isBlocked ? 'default' : 'destructive',
        onPress: async () => {
          try {
            const myRef = doc(db, 'users', currentUserId);
            if (isBlocked) {
              await updateDoc(myRef, { usuariosBloqueados: arrayRemove(userId) });
              setIsBlocked(false);
            } else {
              // Bloquear: quitar relación de follow también
              await updateDoc(myRef, {
                usuariosBloqueados: arrayUnion(userId),
                following: arrayRemove(userId),
                followers: arrayRemove(userId),
              });
              await updateDoc(doc(db, 'users', userId), {
                followers: arrayRemove(currentUserId),
                following: arrayRemove(currentUserId),
              });
              setIsBlocked(true);
              setIsFollowing(false);
              setHasPendingRequest(false);
            }
          } catch (_) {
            Alert.alert('Error', 'No se pudo completar la acción');
          }
        },
      },
    ]);
  }, [isBlocked, userId, currentUserId, user]);

  const isExpired = (event) => {
    try {
      const [day, month, year] = event.date.split('/');
      const [hours, minutes] = (event.time || '23:59').split(':');
      return new Date(year, month - 1, day, hours, minutes) < new Date();
    } catch { return false; }
  };

  const { activeEvents, expiredEvents } = useMemo(() => {
    const parse = e => { const [d,m,y] = e.date.split('/'); return new Date(y,m-1,d); };
    const active = events.filter(e => !isExpired(e)).sort((a,b) => parse(a)-parse(b));
    const expired = events.filter(e => isExpired(e)).sort((a,b) => parse(b)-parse(a));
    return { activeEvents: active, expiredEvents: expired };
  }, [events]);

  const handleEventPress = useCallback((event) => {
    navigation.navigate('EventDetail', { event });
  }, [navigation]);

  const getFollowButtonText = () => {
    if (isFollowing) return 'Siguiendo';
    if (hasPendingRequest) return 'Solicitado';
    return 'Seguir';
  };

  const getFollowButtonIcon = () => {
    if (isFollowing) return 'checkmark';
    if (hasPendingRequest) return 'time';
    return 'person-add';
  };

  // Verificar si puede ver el contenido
  const isPrivateProfile = user?.perfilPublico === false;
  const canViewContent = isOwnProfile || isFollowing || !isPrivateProfile;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6c5ce7" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Usuario no encontrado</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.coverContainer}>
          {user.coverImage ? (
            <Image source={{ uri: user.coverImage }} style={styles.coverImage} />
          ) : null}
        </View>

        <View style={styles.profileSection}>
          <UserAvatar uri={user.avatar} size={90} style={styles.avatar} />
          
          <View style={styles.nameRow}>
            <Text style={styles.name}>{user.name}</Text>
            {isPrivateProfile && (
              <Ionicons name="lock-closed" size={18} color="#888" style={styles.lockIcon} />
            )}
          </View>
          
          {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{canViewContent ? events.length : '-'}</Text>
              <Text style={styles.statLabel}>Eventos</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{user.followers?.length || 0}</Text>
              <Text style={styles.statLabel}>Seguidores</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{user.following?.length || 0}</Text>
              <Text style={styles.statLabel}>Siguiendo</Text>
            </View>
          </View>

          {!isOwnProfile && (
            <View style={styles.actionButtons}>
              {!isBlocked && (
                <TouchableOpacity
                  style={[
                    styles.followButton,
                    isFollowing && styles.followingButton,
                    hasPendingRequest && styles.pendingButton
                  ]}
                  onPress={handleFollow}
                >
                  <Ionicons name={getFollowButtonIcon()} size={20} color="#fff" />
                  <Text style={styles.followButtonText}>{getFollowButtonText()}</Text>
                </TouchableOpacity>
              )}

              {!isBlocked && (
                <TouchableOpacity style={styles.messageButton} onPress={handleMessage}>
                  <Ionicons name="chatbubble" size={20} color="#fff" />
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.blockButton} onPress={handleBlock}>
                <Ionicons
                  name={isBlocked ? 'ban-outline' : 'ban'}
                  size={20}
                  color={isBlocked ? '#888' : '#e74c3c'}
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.blockButton} onPress={() => setShowReport(true)}>
                <Ionicons name="flag-outline" size={20} color="#888" />
              </TouchableOpacity>
            </View>
          )}
          <ReportModal visible={showReport} onClose={() => setShowReport(false)} targetType="user" targetId={userId} />
        </View>

        {canViewContent ? (
          <View style={styles.eventsSection}>
            <Text style={styles.sectionTitle}>Eventos organizados</Text>
            {events.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={50} color="#888" />
                <Text style={styles.emptyText}>No ha organizado eventos aun</Text>
              </View>
            ) : (
              <>
                {activeEvents.length > 0 && (
                  <>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="radio-button-on" size={14} color="#00b894" />
                      <Text style={styles.sectionLabel}>Activos</Text>
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
                      <Text style={[styles.sectionLabel, styles.sectionLabelMuted]}>Pasados</Text>
                      <Text style={styles.sectionCount}>{expiredEvents.length}</Text>
                    </View>
                    {expiredEvents.map(event => (
                      <View key={event.id} style={styles.expiredWrapper}>
                        <EventCard event={event} onPress={() => handleEventPress(event)} />
                        <View style={styles.expiredOverlay} pointerEvents="none">
                          <Text style={styles.expiredLabel}>FINALIZADO</Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </>
            )}
          </View>
        ) : (
          <View style={styles.privateSection}>
            <View style={styles.privateCard}>
              <Ionicons name="lock-closed" size={50} color="#6c5ce7" />
              <Text style={styles.privateTitle}>Esta cuenta es privada</Text>
              <Text style={styles.privateText}>Sigue a esta cuenta para ver sus eventos y actividad</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#1a1a2e'},
  loadingContainer: {flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center'},
  errorText: {color: '#888', fontSize: 16},
  header: {position: 'absolute', top: 50, left: 15, zIndex: 10},
  backButton: {backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8},
  coverContainer: {height: 150, backgroundColor: '#2d2d44'},
  coverImage: {width: '100%', height: '100%'},
  profileSection: {alignItems: 'center', paddingHorizontal: 20, marginTop: -50},
  avatar: {width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#1a1a2e', backgroundColor: '#2d2d44'},
  nameRow: {flexDirection: 'row', alignItems: 'center', marginTop: 15},
  name: {fontSize: 24, fontWeight: 'bold', color: '#fff'},
  lockIcon: {marginLeft: 8},
  bio: {fontSize: 14, color: '#888', textAlign: 'center', marginTop: 8, paddingHorizontal: 20},
  statsRow: {flexDirection: 'row', marginTop: 20, paddingHorizontal: 20},
  statItem: {alignItems: 'center', marginHorizontal: 20},
  statNumber: {fontSize: 20, fontWeight: 'bold', color: '#fff'},
  statLabel: {fontSize: 13, color: '#888', marginTop: 2},
  actionButtons: {flexDirection: 'row', marginTop: 20},
  followButton: {flexDirection: 'row', alignItems: 'center', backgroundColor: '#6c5ce7', paddingHorizontal: 25, paddingVertical: 12, borderRadius: 25, marginRight: 10},
  followingButton: {backgroundColor: '#2d2d44'},
  pendingButton: {backgroundColor: '#fdcb6e'},
  followButtonText: {color: '#fff', fontWeight: '600', marginLeft: 8},
  messageButton: {backgroundColor: '#2d2d44', padding: 12, borderRadius: 25},
  blockButton: {backgroundColor: '#2d2d44', padding: 12, borderRadius: 25, marginLeft: 8},
  eventsSection: {paddingVertical: 20},
  sectionTitle: {fontSize: 18, fontWeight: '600', color: '#fff', paddingHorizontal: 20, marginBottom: 15},
  sectionHeader: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 6},
  sectionLabel: {fontSize: 14, fontWeight: '700', color: '#fff', flex: 1},
  sectionLabelMuted: {color: '#888'},
  sectionCount: {fontSize: 13, color: '#888', fontWeight: '600'},
  expiredWrapper: {position: 'relative'},
  expiredOverlay: {position: 'absolute', top: 10, left: 20, right: 20, bottom: 10, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center'},
  expiredLabel: {color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 1, opacity: 0.9},
  emptyState: {alignItems: 'center', paddingVertical: 40},
  emptyText: {color: '#888', marginTop: 10},
  privateSection: {padding: 20},
  privateCard: {backgroundColor: '#2d2d44', borderRadius: 16, padding: 40, alignItems: 'center'},
  privateTitle: {fontSize: 18, fontWeight: '600', color: '#fff', marginTop: 15},
  privateText: {fontSize: 14, color: '#888', textAlign: 'center', marginTop: 8},
});

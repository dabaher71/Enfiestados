import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { subscribeToEvents } from '../services/eventService';
import { createNotification, NOTIFICATION_TYPES } from '../services/notificationService';
import { getOrCreateChat } from '../services/chatService';
import EventCard from '../components/EventCard';

export default function UserProfileScreen({ route, navigation }) {
  const { userId } = route.params;
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  
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

  const handleEventPress = (event) => {
    navigation.navigate('EventDetail', { event });
  };

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
          <Image source={{ uri: user.coverImage || 'https://via.placeholder.com/400x150' }} style={styles.coverImage} />
        </View>

        <View style={styles.profileSection}>
          <Image source={{ uri: user.avatar || 'https://via.placeholder.com/100' }} style={styles.avatar} />
          
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

              <TouchableOpacity style={styles.messageButton} onPress={handleMessage}>
                <Ionicons name="chatbubble" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
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
              events.map(event => (
                <EventCard key={event.id} event={event} onPress={() => handleEventPress(event)} />
              ))
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
  eventsSection: {paddingVertical: 20},
  sectionTitle: {fontSize: 18, fontWeight: '600', color: '#fff', paddingHorizontal: 20, marginBottom: 15},
  emptyState: {alignItems: 'center', paddingVertical: 40},
  emptyText: {color: '#888', marginTop: 10},
  privateSection: {padding: 20},
  privateCard: {backgroundColor: '#2d2d44', borderRadius: 16, padding: 40, alignItems: 'center'},
  privateTitle: {fontSize: 18, fontWeight: '600', color: '#fff', marginTop: 15},
  privateText: {fontSize: 14, color: '#888', textAlign: 'center', marginTop: 8},
});

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Image, KeyboardAvoidingView, Linking, Modal, Platform, SafeAreaView, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import CommentsSection from '../components/CommentsSection';
import { auth, db } from '../config/firebase';
import { getOrCreateChat, sendMessage } from '../services/chatService';
import { deleteEvent, toggleAttendance, toggleLike } from '../services/eventService';
import { createNotification, NOTIFICATION_TYPES } from '../services/notificationService';

export default function EventDetailScreen({ route, navigation }) {
  const { event } = route.params;
  const [likes, setLikes] = useState(event.likes || []);
  const [attendees, setAttendees] = useState(event.attendees || []);
  const [showOptions, setShowOptions] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [chats, setChats] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [organizerAvatar, setOrganizerAvatar] = useState(event.organizerAvatar || '');
  const [organizerName, setOrganizerName] = useState(event.organizerName || '');
  const [commentsState, setCommentsState] = useState(event.comments || []);
  const userId = auth.currentUser?.uid;
  const isLiked = likes.includes(userId);
  const isAttending = attendees.includes(userId);
  const isOrganizer = userId === event.organizerId;
  // helper to try several possible uid fields inside a comment object
  const getCommentUserId = (c) => c.userId || c.uid || c.authorId || (c.user && (c.user.uid || c.user.id)) || c.ownerId;

  const eventLink = `https://enfiestados.app/evento/${event.id}`;

  const loadOrganizerAndComments = async () => {
    try {
      // organizer latest data
      if (event.organizerId) {
        const orgDoc = await getDoc(doc(db, 'users', event.organizerId));
        if (orgDoc.exists()) {
          const data = orgDoc.data();
          setOrganizerAvatar(data.avatar || '');
          setOrganizerName(data.name || data.displayName || event.organizerName || '');
        }
      }

      // comments: replace avatar/name with latest user data when available
      if (event.comments && event.comments.length > 0) {
        const uniqueIds = [...new Set(event.comments.map(c => getCommentUserId(c)).filter(Boolean))];
        const userMap = {};
        for (const uid of uniqueIds) {
          try {
            const uDoc = await getDoc(doc(db, 'users', uid));
            if (uDoc.exists()) userMap[uid] = uDoc.data();
          } catch (err) {
            console.error('Error cargando usuario de comentario', uid, err);
          }
        }
        const updatedComments = event.comments.map(c => {
          const cid = getCommentUserId(c);
          if (cid && userMap[cid]) {
            return {
              ...c,
              avatar: userMap[cid].avatar || c.avatar,
              name: userMap[cid].name || userMap[cid].displayName || c.name,
            };
          }
          return c;
        });
        setCommentsState(updatedComments);
      } else {
        setCommentsState([]);
      }
    } catch (error) {
      console.error('Error cargando organizer/comentarios:', error);
    }
  };

  useEffect(() => {
    // load on mount
    loadOrganizerAndComments();
    // reload when screen focused (so avatar updates when user returns)
    const unsub = navigation.addListener?.('focus', () => {
      loadOrganizerAndComments();
    });
    return () => {
      if (unsub && typeof unsub === 'function') unsub();
    };
  }, [event, navigation]);

  const handleLike = async () => {
    try {
      const newLikes = await toggleLike(event.id, userId);
      setLikes(newLikes);
      if (!isLiked) {
        await createNotification({
          type: NOTIFICATION_TYPES.LIKE,
          fromUserId: userId,
          fromUserName: auth.currentUser.displayName || auth.currentUser.email.split('@')[0],
          fromUserAvatar: auth.currentUser.photoURL || '',
          toUserId: event.organizerId,
          message: 'le dio like a tu evento',
          eventId: event.id,
          eventData: event,
        });
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleAttend = async () => {
    try {
      const newAttendees = await toggleAttendance(event.id, userId);
      setAttendees(newAttendees);
      if (!isAttending) {
        await createNotification({
          type: NOTIFICATION_TYPES.ATTEND,
          fromUserId: userId,
          fromUserName: auth.currentUser.displayName || auth.currentUser.email.split('@')[0],
          fromUserAvatar: auth.currentUser.photoURL || '',
          toUserId: event.organizerId,
          message: 'asistira a tu evento',
          eventId: event.id,
          eventData: event,
        });
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleDelete = () => {
    Alert.alert('Eliminar evento', 'Estas seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try {
          await deleteEvent(event.id);
          Alert.alert('Exito', 'Evento eliminado');
          navigation.goBack();
        } catch (error) {
          Alert.alert('Error', 'No se pudo eliminar');
        }
      }},
    ]);
  };

  const handleEdit = () => {
    setShowOptions(false);
    navigation.navigate('EditEvent', { event });
  };

  const openMaps = () => {
    const lat = event.location?.lat;
    const lng = event.location?.lng;
    if (lat && lng) {
      Linking.openURL('https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng);
    }
  };

  const handleShare = async () => {
    setShowShareModal(true);
    loadUserChats();
  };

  const loadUserChats = async () => {
    setLoadingChats(true);
    try {
      const chatsQuery = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', userId)
      );
      const snapshot = await getDocs(chatsQuery);
      const chatsData = [];
      
      for (const chatDoc of snapshot.docs) {
        const chatData = chatDoc.data();
        const otherUserId = chatData.participants.find(id => id !== userId);
        const userDoc = await getDoc(doc(db, 'users', otherUserId));
        if (userDoc.exists()) {
          chatsData.push({
            id: chatDoc.id,
            uid: otherUserId,
            ...userDoc.data()
          });
        }
      }
      setChats(chatsData);
    } catch (error) {
      console.error('Error cargando chats:', error);
    }
    setLoadingChats(false);
  };

  const shareExternal = async () => {
    setShowShareModal(false);
    try {
      await Share.share({
        message: `Mira este evento en Enfiestados: ${event.title}\n\n${event.date} a las ${event.time}\n${event.location?.name || 'Evento virtual'}\n\n${eventLink}`,
        title: event.title,
      });
    } catch (error) {
      console.error('Error compartiendo:', error);
    }
  };

  const copyLink = async () => {
    await Clipboard.setStringAsync(eventLink);
    Alert.alert('Copiado', 'Link copiado al portapapeles');
    setShowShareModal(false);
  };

  const shareToChat = async (chat) => {
    try {
      const chatData = await getOrCreateChat(userId, chat.uid);
      const messageText = `Te comparto este evento: ${event.title}\n${event.date} - ${event.time}\n${eventLink}`;
      await sendMessage(chatData.id, userId, messageText);
      setShowShareModal(false);
      Alert.alert('Enviado', `Evento compartido con ${chat.name}`);
    } catch (error) {
      console.error('Error enviando:', error);
      Alert.alert('Error', 'No se pudo enviar');
    }
  };

  const hasLocation = event.location?.lat && event.location?.lng && event.location.lat !== 0;

  const renderChatItem = ({ item }) => (
    <TouchableOpacity style={styles.chatItem} onPress={() => shareToChat(item)}>
      {item.avatar ? (
        <Image source={{ uri: item.avatar }} style={styles.chatAvatar} />
      ) : (
        <View style={[styles.chatAvatar, styles.chatAvatarPlaceholder]}>
          <Ionicons name="person" size={20} color="#888" />
        </View>
      )}
      <Text style={styles.chatName}>{item.name}</Text>
      <Ionicons name="send" size={20} color="#6c5ce7" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={{flex: 1}} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
      <ScrollView 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 50 }}
      >
        
        <View style={styles.imageContainer}>
          <Image source={{ uri: event.image || 'https://via.placeholder.com/400x250' }} style={styles.image} />
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          {isOrganizer ? (
            <TouchableOpacity style={styles.optionsButton} onPress={() => setShowOptions(!showOptions)}>
              <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
            </TouchableOpacity>
          ) : null}
          {showOptions ? (
            <View style={styles.optionsMenu}>
              <TouchableOpacity style={styles.optionItem} onPress={handleEdit}>
                <Ionicons name="create-outline" size={20} color="#fff" />
                <Text style={styles.optionText}>Editar evento</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.optionItem} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={20} color="#e74c3c" />
                <Text style={[styles.optionText, {color: '#e74c3c'}]}>Eliminar evento</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={[styles.typeBadge, event.isVirtual ? styles.virtualBadge : styles.presentialBadge]}>
            <Ionicons name={event.isVirtual ? "videocam" : "location"} size={14} color="#fff" />
            <Text style={styles.typeBadgeText}>{event.isVirtual ? 'Virtual' : 'Presencial'}</Text>
          </View>
        </View>
        <View style={styles.content}>
          <View style={styles.badges}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{event.category}</Text>
            </View>
            {event.isFree ? (
              <View style={styles.freeBadge}>
                <Text style={styles.freeText}>Gratis</Text>
              </View>
            ) : (
              <View style={styles.priceBadge}>
                <Text style={styles.priceText}>₡{event.price}</Text>
              </View>
            )}
          </View>
          <Text style={styles.title}>{event.title}</Text>
          <TouchableOpacity style={styles.organizer} onPress={() => navigation.navigate('UserProfile', { userId: event.organizerId })}>
            <Image source={{ uri: organizerAvatar || event.organizerAvatar || 'https://via.placeholder.com/50' }} style={styles.organizerAvatar} />
            <View>
              <Text style={styles.organizerLabel}>Organizado por</Text>
              <Text style={styles.organizerName}>{organizerName || event.organizerName}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#888" style={styles.chevron} />
          </TouchableOpacity>
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="calendar" size={20} color="#6c5ce7" />
              </View>
              <View>
                <Text style={styles.infoLabel}>Fecha</Text>
                <Text style={styles.infoValue}>{event.date}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="time" size={20} color="#6c5ce7" />
              </View>
              <View>
                <Text style={styles.infoLabel}>Hora</Text>
                <Text style={styles.infoValue}>{event.time}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="location" size={20} color="#6c5ce7" />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.infoLabel}>Ubicacion</Text>
                <Text style={styles.infoValue}>{event.location?.name || 'Por definir'}</Text>
              </View>
            </View>
          </View>
          {!event.isVirtual && hasLocation ? (
            <View style={styles.mapSection}>
              <Text style={styles.sectionTitle}>Ubicacion</Text>
              <View style={styles.mapContainer}>
                <MapView style={styles.map} initialRegion={{latitude: event.location.lat, longitude: event.location.lng, latitudeDelta: 0.01, longitudeDelta: 0.01}} scrollEnabled={false} zoomEnabled={false}>
                  <Marker coordinate={{latitude: event.location.lat, longitude: event.location.lng}}>
                    <Ionicons name="location" size={36} color="#6c5ce7" />
                  </Marker>
                </MapView>
                <TouchableOpacity style={styles.directionsButton} onPress={openMaps}>
                  <Ionicons name="navigate" size={18} color="#fff" />
                  <Text style={styles.directionsText}>Como llegar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
          {event.description ? (
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionTitle}>Descripcion</Text>
              <Text style={styles.description}>{event.description}</Text>
            </View>
          ) : null}
          <View style={styles.statsSection}>
            <View style={styles.stat}>
              <Ionicons name="heart" size={20} color="#e74c3c" />
              <Text style={styles.statNumber}>{likes.length}</Text>
              <Text style={styles.statLabel}>likes</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="people" size={20} color="#00b894" />
              <Text style={styles.statNumber}>{attendees.length}</Text>
              <Text style={styles.statLabel}>asistiran</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="chatbubbles" size={20} color="#0984e3" />
              <Text style={styles.statNumber}>{event.comments?.length || 0}</Text>
              <Text style={styles.statLabel}>comentarios</Text>
            </View>
          </View>
          <CommentsSection eventId={event.id} comments={commentsState} organizerId={event.organizerId} />
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
      <View style={styles.bottomBar}>
        <TouchableOpacity style={[styles.actionButton, isLiked && styles.actionButtonActive]} onPress={handleLike}>
          <Ionicons name={isLiked ? "heart" : "heart-outline"} size={24} color={isLiked ? "#e74c3c" : "#fff"} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.attendButton, isAttending && styles.attendButtonActive]} onPress={handleAttend}>
          <Ionicons name={isAttending ? "checkmark-circle" : "checkmark-circle-outline"} size={24} color="#fff" />
          <Text style={styles.attendButtonText}>{isAttending ? 'Asistire' : 'Asistir'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      <Modal visible={showShareModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Compartir evento</Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.shareOptions}>
              <TouchableOpacity style={styles.shareOption} onPress={shareExternal}>
                <View style={[styles.shareIconCircle, {backgroundColor: '#00b894'}]}>
                  <Ionicons name="share-social" size={24} color="#fff" />
                </View>
                <Text style={styles.shareOptionText}>Compartir en...</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareOption} onPress={copyLink}>
                <View style={[styles.shareIconCircle, {backgroundColor: '#0984e3'}]}>
                  <Ionicons name="link" size={24} color="#fff" />
                </View>
                <Text style={styles.shareOptionText}>Copiar link</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.shareSubtitle}>Enviar a un amigo</Text>
            {loadingChats ? (
              <Text style={styles.loadingText}>Cargando conversaciones...</Text>
            ) : chats.length === 0 ? (
              <Text style={styles.emptyText}>No tienes conversaciones aun</Text>
            ) : (
              <FlatList
                data={chats}
                keyExtractor={(item) => item.id}
                renderItem={renderChatItem}
                style={styles.chatList}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#1a1a2e'},
  imageContainer: {position: 'relative'},
  image: {width: '100%', height: 250, backgroundColor: '#2d2d44'},
  backButton: {position: 'absolute', top: Platform.OS === 'android' ? 40 : 10, left: 15, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8},
  optionsButton: {position: 'absolute', top: Platform.OS === 'android' ? 40 : 10, right: 15, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8, zIndex: 10},
  optionsMenu: {position: 'absolute', top: Platform.OS === 'android' ? 80 : 50, right: 15, backgroundColor: '#2d2d44', borderRadius: 12, padding: 5, zIndex: 100},
  optionItem: {flexDirection: 'row', alignItems: 'center', padding: 12},
  optionText: {color: '#fff', fontSize: 15, marginLeft: 10},
  typeBadge: {position: 'absolute', bottom: 10, right: 15, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20},
  virtualBadge: {backgroundColor: '#0984e3'},
  presentialBadge: {backgroundColor: '#00b894'},
  typeBadgeText: {color: '#fff', fontSize: 12, fontWeight: '600', marginLeft: 5},
  content: {padding: 20},
  badges: {flexDirection: 'row', marginBottom: 15},
  categoryBadge: {backgroundColor: '#6c5ce7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 10},
  categoryText: {color: '#fff', fontSize: 13, fontWeight: '600'},
  freeBadge: {backgroundColor: '#00b894', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20},
  freeText: {color: '#fff', fontSize: 13, fontWeight: '600'},
  priceBadge: {backgroundColor: '#fdcb6e', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20},
  priceText: {color: '#1a1a2e', fontSize: 13, fontWeight: '600'},
  title: {fontSize: 26, fontWeight: 'bold', color: '#fff', marginBottom: 20},
  organizer: {flexDirection: 'row', alignItems: 'center', backgroundColor: '#2d2d44', padding: 15, borderRadius: 12, marginBottom: 20},
  organizerAvatar: {width: 45, height: 45, borderRadius: 23, marginRight: 12, backgroundColor: '#3d3d5c'},
  organizerLabel: {color: '#888', fontSize: 12},
  organizerName: {color: '#fff', fontSize: 16, fontWeight: '600'},
  chevron: {marginLeft: 'auto'},
  infoSection: {backgroundColor: '#2d2d44', borderRadius: 12, padding: 15, marginBottom: 20},
  infoRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 15},
  infoIcon: {width: 40, height: 40, backgroundColor: '#1a1a2e', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12},
  infoLabel: {color: '#888', fontSize: 12},
  infoValue: {color: '#fff', fontSize: 15, fontWeight: '500'},
  mapSection: {marginBottom: 20},
  sectionTitle: {color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 10},
  mapContainer: {borderRadius: 12, overflow: 'hidden', position: 'relative'},
  map: {width: '100%', height: 180},
  directionsButton: {position: 'absolute', bottom: 10, right: 10, backgroundColor: '#6c5ce7', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20},
  directionsText: {color: '#fff', fontWeight: '600', marginLeft: 6},
  descriptionSection: {marginBottom: 20},
  description: {color: '#aaa', fontSize: 15, lineHeight: 22},
  statsSection: {flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#2d2d44', borderRadius: 12, padding: 20, marginBottom: 20},
  stat: {alignItems: 'center'},
  statNumber: {color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 5},
  statLabel: {color: '#888', fontSize: 12},
  bottomBar: {position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', paddingHorizontal: 20, paddingVertical: 15, paddingBottom: 30, borderTopWidth: 1, borderTopColor: '#2d2d44'},
  actionButton: {width: 50, height: 50, backgroundColor: '#2d2d44', borderRadius: 25, justifyContent: 'center', alignItems: 'center'},
  actionButtonActive: {backgroundColor: '#3d3d5c'},
  attendButton: {flex: 1, flexDirection: 'row', backgroundColor: '#6c5ce7', borderRadius: 25, justifyContent: 'center', alignItems: 'center', paddingVertical: 14, marginHorizontal: 15},
  attendButtonActive: {backgroundColor: '#00b894'},
  attendButtonText: {color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 8},
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end'},
  modalContent: {backgroundColor: '#1a1a2e', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%'},
  modalHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20},
  modalTitle: {color: '#fff', fontSize: 20, fontWeight: 'bold'},
  shareOptions: {flexDirection: 'row', justifyContent: 'space-around', marginBottom: 25},
  shareOption: {alignItems: 'center'},
  shareIconCircle: {width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 8},
  shareOptionText: {color: '#fff', fontSize: 13},
  shareSubtitle: {color: '#888', fontSize: 14, marginBottom: 15},
  loadingText: {color: '#888', textAlign: 'center', padding: 20},
  emptyText: {color: '#888', textAlign: 'center', padding: 20},
  chatList: {maxHeight: 250},
  chatItem: {flexDirection: 'row', alignItems: 'center', backgroundColor: '#2d2d44', padding: 15, borderRadius: 12, marginBottom: 10},
  chatAvatar: {width: 45, height: 45, borderRadius: 23, marginRight: 12},
  chatAvatarPlaceholder: {backgroundColor: '#3d3d5c', justifyContent: 'center', alignItems: 'center'},
  chatName: {flex: 1, color: '#fff', fontSize: 16, fontWeight: '500'},
});
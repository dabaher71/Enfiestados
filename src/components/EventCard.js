import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { memo, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../config/firebase';
import { recordSignal } from '../services/signalService';

// Fuera del componente: no se recrea en cada render
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function formatDate(dateString) {
  if (!dateString) return { day: '--', month: '---' };
  const parts = dateString.split('/');
  if (parts.length === 3) {
    return { day: parts[0], month: MONTHS[parseInt(parts[1]) - 1] || parts[1] };
  }
  return { day: '--', month: '---' };
}

// Acepta `dispatch` (patrón dispatcher) o `onPress` (compatibilidad)
// onHide: callback cuando el usuario oculta el evento (señal negativa)
function EventCard({ event, dispatch, onPress, userId, onHide }) {
  const handlePress = dispatch ? () => dispatch({ type: 'PRESS', payload: event }) : onPress;

  const handleLongPress = () => {
    Alert.alert(
      'Ocultar evento',
      '¿No te interesa este evento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'No me interesa',
          style: 'destructive',
          onPress: () => {
            if (userId) recordSignal(userId, event, 'hide');
            onHide?.(event.id);
          },
        },
      ]
    );
  };
  const [organizerAvatar, setOrganizerAvatar] = useState(event.organizerAvatar || '');
  const [organizerName, setOrganizerName] = useState(event.organizerName || '');

  useEffect(() => {
    let mounted = true;
    const loadOrganizerData = async () => {
      try {
        if (event.organizerId) {
          const userDoc = await getDoc(doc(db, 'users', event.organizerId));
          if (userDoc.exists() && mounted) {
            const userData = userDoc.data();
            if (userData.avatar) {
              setOrganizerAvatar(userData.avatar);
            } else {
              setOrganizerAvatar(event.organizerAvatar || '');
            }
            // prefer explicit name fields, fallback to event.organizerName
            const name = userData.name || userData.displayName || event.organizerName || '';
            setOrganizerName(name);
          } else if (mounted) {
            // no user doc: fallback to event props
            setOrganizerAvatar(event.organizerAvatar || '');
            setOrganizerName(event.organizerName || '');
          }
        } else if (mounted) {
          setOrganizerAvatar(event.organizerAvatar || '');
          setOrganizerName(event.organizerName || '');
        }
      } catch (error) {
        console.log('Error cargando datos del organizador:', error);
        if (mounted) {
          setOrganizerAvatar(event.organizerAvatar || '');
          setOrganizerName(event.organizerName || '');
        }
      }
    };

    loadOrganizerData();

    return () => {
      mounted = false;
    };
  }, [event.organizerId, event.organizerAvatar, event.organizerName]);

  const { day, month } = formatDate(event.date);

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} onLongPress={handleLongPress} activeOpacity={0.9}>
      {/* Imagen */}
      <View style={styles.imageContainer}>
        <Image
          source={event.image ? { uri: event.image } : require('../../assets/images/icon.png')}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
        
        {/* Fecha badge */}
        <View style={styles.dateBadge}>
          <Text style={styles.dateDay}>{day}</Text>
          <Text style={styles.dateMonth}>{month}</Text>
        </View>

        {/* Precio badge */}
        <View style={[styles.priceBadge, event.isFree ? styles.freeBadge : styles.paidBadge]}>
          <Text style={[styles.priceText, !event.isFree && styles.paidText]}>
            {event.isFree ? 'Gratis' : `₡${event.price}`}
          </Text>
        </View>
      </View>

      {/* Contenido */}
      <View style={styles.content}>
        {/* Categoría */}
        <View style={styles.categoryRow}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{event.category}</Text>
          </View>
        </View>

        {/* Título */}
        <Text style={styles.title} numberOfLines={2}>{event.title}</Text>

        {/* Ubicación y hora */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="location-outline" size={14} color="#888" />
            <Text style={styles.infoText} numberOfLines={1} ellipsizeMode="tail">
              {event.location?.name || 'Por definir'}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="time-outline" size={14} color="#888" />
            <Text style={styles.infoText}>{event.time}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          {/* Organizador */}
          <View style={styles.organizer}>
            {organizerAvatar ? (
              <Image
                source={{ uri: organizerAvatar }}
                style={styles.organizerAvatar}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <View style={[styles.organizerAvatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={14} color="#888" />
              </View>
            )}
            <Text style={styles.organizerName} numberOfLines={1} ellipsizeMode="tail">
              {organizerName || event.organizerName || 'Organizador'}
            </Text>
          </View>

          {/* Stats */}
          <View style={styles.stats}>
            <View style={styles.statItem}>
              <Ionicons name="heart" size={14} color="#e74c3c" />
              <Text style={styles.statText}>{event.likes?.length || 0}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="people" size={14} color="#00b894" />
              <Text style={styles.statText}>{event.attendees?.length || 0}</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default memo(EventCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    marginHorizontal: 20,
    marginVertical: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  imageContainer: {
    position: 'relative',
    height: 360,
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#3d3d5c',
  },
  dateBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    minWidth: 50,
  },
  dateDay: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  dateMonth: {
    fontSize: 11,
    color: '#6c5ce7',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  priceBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  freeBadge: {
    backgroundColor: '#00b894',
  },
  paidBadge: {
    backgroundColor: '#fdcb6e',
  },
  priceText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  paidText: {
    color: '#1a1a2e',
  },
  content: {
    padding: 20,
  },
  categoryRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  categoryText: {
    color: '#6c5ce7',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    lineHeight: 35,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    flex: 1,
  },
  infoText: {
    color: '#888',
    fontSize: 14,
    marginLeft: 5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 12,
  },
  organizer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  organizerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    backgroundColor: '#3d3d5c',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  organizerName: {
    color: '#aaa',
    fontSize: 14,
    flex: 1,
  },
  stats: {
    flexDirection: 'row',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 15,
  },
  statText: {
    color: '#888',
    fontSize: 14,
    marginLeft: 4,
  },
});
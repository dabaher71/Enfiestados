import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ExternalEventDetailModal from './ExternalEventDetailModal';

const SOURCE_COLORS = {
  'GAM Cultural': '#e17055',
  'EventCR':      '#00b894',
};

export default function ExternalEventCard({ event, style }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [imgError, setImgError] = useState(false);
  const badgeColor = SOURCE_COLORS[event.source] || '#6c5ce7';
  const showPlaceholder = !event.imageUrl || imgError;

  return (
    <>
    <TouchableOpacity style={[styles.card, style]} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
      {showPlaceholder ? (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Text style={styles.imagePlaceholderText} numberOfLines={4}>
            {event.title}
          </Text>
        </View>
      ) : (
        <Image
          source={{ uri: event.imageUrl }}
          style={styles.image}
          contentFit="cover"
          transition={300}
          onError={() => setImgError(true)}
        />
      )}
      <View style={styles.badge}>
        <Text style={[styles.badgeText, { backgroundColor: badgeColor }]}>
          Vía {event.source}
        </Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
        {!!event.dateText && (
          <Text style={styles.date} numberOfLines={1}>
            {event.dateText}
          </Text>
        )}
        {!!event.locationText && (
          <Text style={styles.location} numberOfLines={1}>
            📍 {event.locationText}
          </Text>
        )}
      </View>
    </TouchableOpacity>
    <ExternalEventDetailModal
      event={event}
      visible={modalVisible}
      onClose={() => setModalVisible(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 220,
    borderRadius: 14,
    backgroundColor: '#16213e',
    marginRight: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 180,
    backgroundColor: '#0f3460',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  imagePlaceholderText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 21,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    overflow: 'hidden',
  },
  info: {
    padding: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    lineHeight: 18,
  },
  date: {
    fontSize: 11,
    color: '#6c5ce7',
    fontWeight: '600',
    marginBottom: 2,
  },
  location: {
    fontSize: 11,
    color: '#a0a0b0',
  },
});

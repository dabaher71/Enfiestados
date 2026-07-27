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
            {event.locationText}
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
    backgroundColor: '#2d2d44',
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  image: {
    width: '100%',
    height: 360,
    backgroundColor: '#3d3d54',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  imagePlaceholderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 26,
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: 'hidden',
  },
  info: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    lineHeight: 35,
  },
  date: {
    fontSize: 14,
    color: '#6c5ce7',
    fontWeight: '600',
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    color: '#a0a0b0',
  },
});

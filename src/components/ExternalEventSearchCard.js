import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ExternalEventDetailModal from './ExternalEventDetailModal';

const SOURCE_COLORS = {
  'GAM Cultural': '#e17055',
  'EventCR':      '#00b894',
};

export default function ExternalEventSearchCard({ event }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [imgError, setImgError] = useState(false);
  const badgeColor = SOURCE_COLORS[event.source] || '#6c5ce7';
  const showPlaceholder = !event.imageUrl || imgError;

  return (
    <>
    <TouchableOpacity style={styles.row} onPress={() => setModalVisible(true)} activeOpacity={0.8}>
      {showPlaceholder ? (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
          <Text style={styles.thumbnailPlaceholderText} numberOfLines={3}>
            {event.title}
          </Text>
        </View>
      ) : (
        <Image
          source={{ uri: event.imageUrl }}
          style={styles.thumbnail}
          contentFit="cover"
          transition={200}
          onError={() => setImgError(true)}
        />
      )}
      <View style={styles.content}>
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
      <View style={[styles.badge, { backgroundColor: badgeColor }]}>
        <Text style={styles.badgeText}>{event.source}</Text>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    marginBottom: 8,
    padding: 10,
    overflow: 'hidden',
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#0f3460',
    flexShrink: 0,
  },
  thumbnailPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  thumbnailPlaceholderText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 13,
  },
  content: {
    flex: 1,
    paddingHorizontal: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 3,
    lineHeight: 17,
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
  badge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },
});

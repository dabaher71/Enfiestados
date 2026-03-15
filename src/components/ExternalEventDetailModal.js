import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { safeOpenURL } from '../utils/security';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const SOURCE_COLORS = {
  'GAM Cultural': '#e17055',
  'EventCR':      '#00b894',
};

export default function ExternalEventDetailModal({ event, visible, onClose }) {
  const [imgError, setImgError] = useState(false);
  if (!event) return null;
  const badgeColor = SOURCE_COLORS[event.source] || '#6c5ce7';
  const showPlaceholder = !event.imageUrl || imgError;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Imagen grande */}
          <View style={styles.imageContainer}>
            {showPlaceholder ? (
              <View style={[styles.image, styles.imagePlaceholder]}>
                <Text style={styles.imagePlaceholderText} numberOfLines={5}>
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
            {/* Badge fuente */}
            <View style={[styles.sourceBadge, { backgroundColor: badgeColor }]}>
              <Text style={styles.sourceBadgeText}>Vía {event.source}</Text>
            </View>
            {/* Cerrar */}
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Contenido */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>{event.title}</Text>

            {!!event.dateText && (
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={15} color="#6c5ce7" />
                <Text style={styles.metaText}>{event.dateText}</Text>
              </View>
            )}

            {!!event.locationText && (
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={15} color="#6c5ce7" />
                <Text style={styles.metaText}>{event.locationText}</Text>
              </View>
            )}

            {!!event.description && (
              <Text style={styles.description}>{event.description}</Text>
            )}

            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={() => safeOpenURL(event.eventUrl)}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaText}>Ver más información</Text>
              <Ionicons name="open-outline" size={18} color="#fff" />
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    maxHeight: '88%',
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: Math.round(SCREEN_HEIGHT * 0.42),
    backgroundColor: '#0f3460',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  imagePlaceholderText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 30,
  },
  sourceBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  sourceBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    padding: 20,
    paddingBottom: 36,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 16,
    lineHeight: 26,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  metaText: {
    color: '#ccc',
    fontSize: 14,
    flex: 1,
  },
  description: {
    color: '#bbb',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 16,
    marginBottom: 4,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6c5ce7',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 24,
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';

// Componente base de Skeleton con animación (UI thread via Reanimated)
export function Skeleton({ width, height, borderRadius = 4, style }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    return () => cancelAnimation(opacity);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius },
        animatedStyle,
        style,
      ]}
    />
  );
}

// Skeleton para EventCard del Feed
export function EventCardSkeleton() {
  return (
    <View style={styles.eventCard}>
      {/* Imagen */}
      <Skeleton width="100%" height={180} borderRadius={0} />
      
      <View style={styles.eventContent}>
        {/* Badges */}
        <View style={styles.row}>
          <Skeleton width={70} height={24} borderRadius={12} />
          <Skeleton width={50} height={20} borderRadius={10} />
        </View>
        
        {/* Título */}
        <Skeleton width="90%" height={20} borderRadius={4} style={{ marginTop: 12 }} />
        
        {/* Ubicación y hora */}
        <View style={[styles.row, { marginTop: 12 }]}>
          <Skeleton width={16} height={16} borderRadius={8} />
          <Skeleton width="60%" height={14} borderRadius={4} style={{ marginLeft: 8 }} />
        </View>
        
        <View style={[styles.row, { marginTop: 8 }]}>
          <Skeleton width={16} height={16} borderRadius={8} />
          <Skeleton width="40%" height={14} borderRadius={4} style={{ marginLeft: 8 }} />
        </View>
        
        {/* Organizador */}
        <View style={[styles.row, { marginTop: 16 }]}>
          <Skeleton width={36} height={36} borderRadius={18} />
          <Skeleton width={100} height={14} borderRadius={4} style={{ marginLeft: 10 }} />
          <View style={{ flex: 1 }} />
          <Skeleton width={40} height={20} borderRadius={4} />
          <Skeleton width={40} height={20} borderRadius={4} style={{ marginLeft: 12 }} />
        </View>
      </View>
    </View>
  );
}

// Skeleton para SearchScreen (tarjeta horizontal pequeña)
export function SearchCardSkeleton() {
  return (
    <View style={styles.searchCard}>
      <Skeleton width={100} height={120} borderRadius={0} />
      <View style={styles.searchCardInfo}>
        <View style={styles.row}>
          <Skeleton width={60} height={18} borderRadius={8} />
          <Skeleton width={45} height={16} borderRadius={8} />
        </View>
        <Skeleton width="90%" height={16} borderRadius={4} style={{ marginTop: 8 }} />
        <Skeleton width="70%" height={14} borderRadius={4} style={{ marginTop: 6 }} />
        <Skeleton width="50%" height={12} borderRadius={4} style={{ marginTop: 6 }} />
        <View style={[styles.row, { marginTop: 10 }]}>
          <Skeleton width={30} height={14} borderRadius={4} />
          <Skeleton width={30} height={14} borderRadius={4} style={{ marginLeft: 12 }} />
        </View>
      </View>
    </View>
  );
}

// Skeleton para el carrusel del mapa
export function MapCarouselSkeleton() {
  return (
    <View style={styles.mapCard}>
      <Skeleton width="100%" height={100} borderRadius={0} />
      <View style={styles.mapCardContent}>
        <View style={styles.row}>
          <Skeleton width={60} height={18} borderRadius={8} />
          <Skeleton width={50} height={16} borderRadius={8} />
        </View>
        <Skeleton width="85%" height={16} borderRadius={4} style={{ marginTop: 8 }} />
        <Skeleton width="70%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
        <Skeleton width="50%" height={12} borderRadius={4} style={{ marginTop: 4 }} />
      </View>
    </View>
  );
}

// Skeleton para perfil de usuario
export function ProfileSkeleton() {
  return (
    <View style={styles.profile}>
      {/* Cover */}
      <Skeleton width="100%" height={150} borderRadius={0} />
      
      {/* Avatar */}
      <View style={styles.profileAvatarContainer}>
        <Skeleton width={100} height={100} borderRadius={50} />
      </View>
      
      <View style={styles.profileContent}>
        {/* Nombre */}
        <Skeleton width={150} height={24} borderRadius={4} style={{ alignSelf: 'center', marginTop: 55 }} />
        
        {/* Email */}
        <Skeleton width={200} height={14} borderRadius={4} style={{ alignSelf: 'center', marginTop: 8 }} />
        
        {/* Bio */}
        <Skeleton width={250} height={14} borderRadius={4} style={{ alignSelf: 'center', marginTop: 8 }} />
        
        {/* Stats */}
        <View style={[styles.row, { justifyContent: 'space-around', marginTop: 20 }]}>
          <View style={{ alignItems: 'center' }}>
            <Skeleton width={40} height={24} borderRadius={4} />
            <Skeleton width={60} height={12} borderRadius={4} style={{ marginTop: 4 }} />
          </View>
          <View style={{ alignItems: 'center' }}>
            <Skeleton width={40} height={24} borderRadius={4} />
            <Skeleton width={60} height={12} borderRadius={4} style={{ marginTop: 4 }} />
          </View>
          <View style={{ alignItems: 'center' }}>
            <Skeleton width={40} height={24} borderRadius={4} />
            <Skeleton width={60} height={12} borderRadius={4} style={{ marginTop: 4 }} />
          </View>
        </View>
      </View>
    </View>
  );
}

// Lista de skeletons para el feed
export function FeedSkeleton({ count = 3 }) {
  return (
    <View style={styles.feedContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <EventCardSkeleton key={index} />
      ))}
    </View>
  );
}

// Lista de skeletons para búsqueda
export function SearchListSkeleton({ count = 5 }) {
  return (
    <View style={styles.searchListContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <SearchCardSkeleton key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#3d3d5c',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventCard: {
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    marginHorizontal: 20,
    marginVertical: 10,
    overflow: 'hidden',
  },
  eventContent: {
    padding: 15,
  },
  searchCard: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  searchCardInfo: {
    flex: 1,
    padding: 12,
  },
  mapCard: {
    width: 280,
    height: 200,
    backgroundColor: '#2d2d44',
    borderRadius: 14,
    marginRight: 10,
    overflow: 'hidden',
  },
  mapCardContent: {
    padding: 12,
  },
  profile: {
    backgroundColor: '#1a1a2e',
  },
  profileAvatarContainer: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    borderWidth: 4,
    borderColor: '#1a1a2e',
    borderRadius: 52,
  },
  profileContent: {
    paddingHorizontal: 20,
  },
  feedContainer: {
    flex: 1,
  },
  searchListContainer: {
    paddingHorizontal: 15,
  },
});


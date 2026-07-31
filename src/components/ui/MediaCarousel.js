// MediaCarousel — FIX_ROUND_5 § 2. Un solo componente, tres consumidores:
// EventCardLarge (Home/Explorar), detalle de evento, detalle de publicación.
//
// Reglas que no se negocian (ver doc):
// - directionalLockEnabled: sin esto el swipe horizontal secuestra el scroll
//   vertical del feed.
// - El índice se actualiza en onMomentumScrollEnd, nunca en onScroll (un
//   setState por frame de scroll tira los FPS en una lista de cards grandes).
// - 1 imagen = cero FlatList/puntos/contador/listeners.
// - Encuadre según forma: horizontal (ratio > 1.15) → cover. Cuadrada o
//   vertical → marco desenfocado (nunca se recorta un afiche con texto impreso).
// - Nada de autoplay ni zonas de toque invisibles a los lados.
import { Image } from 'expo-image';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import useReducedMotion from '../../hooks/useReducedMotion';
import Skeleton from './Skeleton';
import Text from './Text';

const HORIZONTAL_RATIO_THRESHOLD = 1.15;
const MAX_IMAGES = 10;
const DOTS_MAX = 8;

// Una imagen del carrusel: reserva su alto (aspectRatio de la caja), muestra
// skeleton hasta cargar, decide cover vs. marco desenfocado según su forma,
// y se salta en silencio si falla.
function CarouselImage({ uri, width, aspectRatio, reduced, onPress, accessibilityLabel, onFail }) {
  const { colors } = useTheme();
  const [ratio, setRatio] = useState(null); // null = todavía no sabemos la forma
  const [loaded, setLoaded] = useState(false);

  const handleLoad = (e) => {
    const { width: w, height: h } = e?.source ?? {};
    if (w && h) setRatio(w / h);
    setLoaded(true);
  };

  const isHorizontal = ratio == null || ratio > HORIZONTAL_RATIO_THRESHOLD;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={accessibilityLabel}
      style={{ width, aspectRatio, overflow: 'hidden' }}
    >
      {!loaded && (
        <Skeleton width="100%" height="100%" style={StyleSheet.absoluteFill} />
      )}
      {isHorizontal ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="top"
          transition={reduced ? 0 : 200}
          onLoad={handleLoad}
          onError={onFail}
        />
      ) : (
        // Marco desenfocado — el afiche trae su propia tipografía (fecha,
        // precio, artista); recortarlo destruye la información que vende
        // el evento. Se enmarca completo, nunca se recorta.
        <View style={{ flex: 1, backgroundColor: colors['bg.surface'] }}>
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            blurRadius={22}
            contentFit="cover"
            transition={reduced ? 0 : 200}
          />
          <View style={styles.framedInner}>
            <Image
              source={{ uri }}
              style={[styles.framedImg, { aspectRatio: ratio ?? 1 }]}
              contentFit="contain"
              transition={reduced ? 0 : 200}
              onLoad={handleLoad}
              onError={onFail}
            />
          </View>
        </View>
      )}
    </Pressable>
  );
}

export default function MediaCarousel({
  images,
  aspectRatio = 1.3,
  onPress,
  labelPrefix = '',
  topLeftSlot,
  style,
  onIndexChange,
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [boxWidth, setBoxWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [brokenUris, setBrokenUris] = useState(() => new Set());
  const listRef = useRef(null);

  const source = useMemo(() => (images ?? []).slice(0, MAX_IMAGES), [images]);
  const effective = useMemo(
    () => source.filter(uri => !brokenUris.has(uri)),
    [source, brokenUris]
  );

  const handleFail = useCallback((uri) => {
    setBrokenUris(prev => (prev.has(uri) ? prev : new Set(prev).add(uri)));
  }, []);

  const handleMomentumEnd = useCallback((e) => {
    if (!boxWidth) return;
    const i = Math.max(0, Math.min(Math.round(e.nativeEvent.contentOffset.x / boxWidth), effective.length - 1));
    setIndex(i);
    onIndexChange?.(i);
    const next = effective[i + 1];
    if (next) Image.prefetch(next).catch(() => {});
  }, [boxWidth, effective, onIndexChange]);

  const onLayout = useCallback((e) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== boxWidth) setBoxWidth(w);
  }, [boxWidth]);

  const renderItem = useCallback(({ item, index: i }) => (
    <CarouselImage
      uri={item}
      width={boxWidth}
      aspectRatio={aspectRatio}
      reduced={reduced}
      onPress={onPress}
      accessibilityLabel={`Imagen ${i + 1} de ${effective.length}${labelPrefix ? ` ${labelPrefix}` : ''}`}
      onFail={() => handleFail(item)}
    />
  ), [boxWidth, aspectRatio, reduced, onPress, effective.length, labelPrefix, handleFail]);

  const showDots = effective.length > 1 && effective.length <= DOTS_MAX;
  const showCounter = effective.length > 1;

  if (effective.length === 0) {
    // Sin imágenes válidas — placeholder de marca, nunca caja gris rota.
    return (
      <View style={[{ aspectRatio, overflow: 'hidden' }, styles.brandPlaceholder, { backgroundColor: colors['bg.surface'] }, style]}>
        <Pressable onPress={onPress} style={StyleSheet.absoluteFill} accessibilityRole="imagebutton" accessibilityLabel="Sin imagen" />
      </View>
    );
  }

  // Una sola imagen: sin FlatList, sin puntos, sin contador, sin listeners.
  if (effective.length === 1) {
    return (
      <View onLayout={onLayout} style={[{ aspectRatio, overflow: 'hidden' }, style]}>
        {boxWidth > 0 && (
          <CarouselImage
            uri={effective[0]}
            width={boxWidth}
            aspectRatio={aspectRatio}
            reduced={reduced}
            onPress={onPress}
            accessibilityLabel={`Imagen${labelPrefix ? ` ${labelPrefix}` : ''}`}
            onFail={() => handleFail(effective[0])}
          />
        )}
        {topLeftSlot && <View style={styles.topLeft}>{topLeftSlot}</View>}
      </View>
    );
  }

  return (
    <View onLayout={onLayout} style={[{ aspectRatio, overflow: 'hidden' }, style]}>
      {boxWidth > 0 && (
        <FlatList
          ref={listRef}
          data={effective}
          keyExtractor={(uri, i) => `${uri}_${i}`}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          snapToInterval={boxWidth}
          decelerationRate="fast"
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumEnd}
          getItemLayout={(_, i) => ({ length: boxWidth, offset: boxWidth * i, index: i })}
          initialNumToRender={2}
          windowSize={3}
          // Reciclado de fila (FlashList) siempre reinicia al índice 0 —
          // guardar el índice por evento no vale lo que cuesta.
        />
      )}

      {topLeftSlot && <View style={styles.topLeft}>{topLeftSlot}</View>}

      {showCounter && (
        <View style={[styles.counter, { backgroundColor: 'rgba(11,9,16,0.7)' }]}>
          <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_700Bold', color: colors['text.primary'] }}>
            {index + 1}
          </Text>
          <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors['text.tertiary'] }}>
            {' / '}{effective.length}
          </Text>
        </View>
      )}

      {showDots && (
        <View style={styles.dotsRow} pointerEvents="none">
          {effective.map((uri, i) => (
            <View
              key={uri + i}
              style={[
                styles.dot,
                i === index
                  ? { width: 18, backgroundColor: colors['action.primary'] }
                  : { width: 6, backgroundColor: 'rgba(247,244,239,0.5)' },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  framedInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[3],
  },
  framedImg: {
    height: '100%',
    borderRadius: radius.sm,
  },
  brandPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topLeft: {
    position: 'absolute',
    top: space[3],
    left: space[3],
  },
  counter: {
    position: 'absolute',
    top: space[3],
    right: space[3],
    flexDirection: 'row',
    borderRadius: radius.full,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  dotsRow: {
    position: 'absolute',
    bottom: space[3],
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space[1],
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});

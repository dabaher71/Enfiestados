// MediaCarousel — FIX_ROUND_5 § 2. Un solo componente, tres consumidores:
// EventCardLarge (Home/Explorar), detalle de evento, detalle de publicación.
//
// Reglas que no se negocian (ver doc):
// - directionalLockEnabled: sin esto el swipe horizontal secuestra el scroll
//   vertical del feed.
// - El índice se actualiza en onMomentumScrollEnd, nunca en onScroll (un
//   setState por frame de scroll tira los FPS en una lista de cards grandes).
// - 1 imagen = cero FlatList/puntos/contador/listeners.
// - Encuadre según forma: horizontal (ratio > 1.15) → cover. Cuadrada,
//   vertical, o todavía sin cargar → marco desenfocado (nunca se recorta un
//   afiche con texto impreso — "sin cargar" arranca ahí porque es la opción
//   segura para cualquier forma).
// - Nada de autoplay ni zonas de toque invisibles a los lados.
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import useReducedMotion from '../../hooks/useReducedMotion';
import Skeleton from './Skeleton';
import Text from './Text';
import { useTranslation } from 'react-i18next';

const HORIZONTAL_RATIO_THRESHOLD = 1.15;
const MAX_IMAGES = 10;
const DOTS_MAX = 8;

// Una imagen del carrusel: reserva su alto (aspectRatio de la caja), muestra
// skeleton hasta cargar, decide cover vs. marco desenfocado según su forma,
// y se salta en silencio si falla.
// Reintentos ante un error de carga antes de dar la imagen por rota. En el
// feed, con scroll rápido y señal mala, una descarga cortada no significa que
// la URL esté mal; antes un solo error la sacaba del carrusel para siempre.
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

function CarouselImage({ uri, width, aspectRatio, reduced, onPress, accessibilityLabel, onFail }) {
  const { colors } = useTheme();
  const [ratio, setRatio] = useState(null); // null = todavía no sabemos la forma
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retryTimer = useRef(null);

  useEffect(() => () => clearTimeout(retryTimer.current), []);

  const handleLoad = (e) => {
    const { width: w, height: h } = e?.source ?? {};
    if (w && h) setRatio(w / h);
    setLoaded(true);
  };

  const handleError = () => {
    if (attempt >= MAX_RETRIES) { onFail?.(); return; }
    clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => setAttempt(a => a + 1), RETRY_DELAY_MS);
  };

  // null → arranca enmarcado, que es seguro para cualquier forma (nunca
  // recorta). Solo pasa a cover una vez que sabemos que es horizontal.
  const isHorizontal = ratio != null && ratio > HORIZONTAL_RATIO_THRESHOLD;

  // Un solo subárbol — la <Image> con onLoad/onError NUNCA se desmonta al
  // conocer la forma real; si isHorizontal cambiara de rama (cover ↔
  // enmarcado) React remonta esa Image y se ve un flash (frame recortado,
  // después el fondo desenfocado solo porque el skeleton ya se ocultó).
  // Acá solo cambian contentFit/estilo sobre la misma instancia.
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={accessibilityLabel}
      style={{ width, aspectRatio, overflow: 'hidden' }}
    >
      <View style={{ flex: 1, backgroundColor: colors['bg.surface'] }}>
        {/* Fondo desenfocado — solo enmarcado y solo DESPUÉS de que cargó la
            principal. Antes se montaba a la vez: pedía la misma URL en
            paralelo (dos descargas por foto, se ve en el log de Glide) y, si
            ganaba la carrera, la card mostraba solo la versión borrosa hasta
            que llegaba la nítida. Montado después, sale de la caché. No lleva
            onLoad/onError, así que no afecta a la imagen principal. */}
        {loaded && !isHorizontal && (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            blurRadius={22}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={uri}
            transition={reduced ? 0 : 200}
          />
        )}
        <View style={[styles.framedInner, isHorizontal && styles.framedInnerFull]}>
          <Image
            // key: cada reintento remonta la Image para que vuelva a pedir la URL.
            key={attempt}
            source={{ uri }}
            style={isHorizontal ? StyleSheet.absoluteFill : [styles.framedImg, { aspectRatio: ratio ?? 1 }]}
            contentFit={isHorizontal ? 'cover' : 'contain'}
            contentPosition={isHorizontal ? 'top' : 'center'}
            cachePolicy="memory-disk"
            recyclingKey={uri}
            priority="high"
            transition={reduced ? 0 : 200}
            onLoad={handleLoad}
            onError={handleError}
          />
        </View>
      </View>
      {/* El skeleton va ENCIMA del contenido: antes estaba debajo de la View
          con fondo bg.surface, que lo tapaba entero, así que mientras cargaba
          la card se veía vacía (o borrosa) en vez de "cargando". */}
      {!loaded && (
        <Skeleton width="100%" height="100%" style={StyleSheet.absoluteFill} />
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
  const { t } = useTranslation();
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
      accessibilityLabel={`${t('carousel.imageOf', { index: i + 1, total: effective.length })}${labelPrefix ? ` ${labelPrefix}` : ''}`}
      onFail={() => handleFail(item)}
    />
  ), [boxWidth, aspectRatio, reduced, onPress, effective.length, labelPrefix, handleFail]);

  const showDots = effective.length > 1 && effective.length <= DOTS_MAX;
  const showCounter = effective.length > 1;

  if (effective.length === 0) {
    // Sin imágenes válidas — placeholder de marca, nunca caja gris rota.
    return (
      <View style={[{ aspectRatio, overflow: 'hidden' }, styles.brandPlaceholder, { backgroundColor: colors['bg.surface'] }, style]}>
        <Pressable onPress={onPress} style={StyleSheet.absoluteFill} accessibilityRole="imagebutton" accessibilityLabel={t('carousel.noImage')} />
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
            accessibilityLabel={`${t('carousel.image')}${labelPrefix ? ` ${labelPrefix}` : ''}`}
            onFail={() => handleFail(effective[0])}
          />
        )}
        {topLeftSlot && <View style={styles.topLeft} pointerEvents="none">{topLeftSlot}</View>}
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

      {topLeftSlot && <View style={styles.topLeft} pointerEvents="none">{topLeftSlot}</View>}

      {showCounter && (
        <View style={[styles.counter, { backgroundColor: 'rgba(11,9,16,0.7)' }]} pointerEvents="none">
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
  // Rama horizontal: la Image pasa a absoluteFill+cover, así que el padding
  // del marco (pensado para "contain") sobra y hay que anularlo.
  framedInnerFull: {
    padding: 0,
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

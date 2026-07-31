// ExternalEventDetailScreen — Detalle de evento importado
// Reconstrucción total según FIX_ROUND_2 § 4.
// Elimina: tres tarjetas separadas, "Hora" vacío, badge fuente violeta, CTA "Asistir",
//          "0 likes / 0 asistirán", "Ubicacion" sin tilde, campo en blanco.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  Dimensions, Pressable, ScrollView, Share, StyleSheet, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import StatusBadge from '../components/ui/StatusBadge';
import Text from '../components/ui/Text';
import { showSnackbar } from '../components/ui/Snackbar';

import { auth, db } from '../config/firebase';
import { toggleSavedExternal } from '../services/externalEventService';
import { requireAccount } from '../lib/requireAccount';
import { safeOpenURL } from '../utils/security';
import { formatDateLong, formatDaysUntil, formatDomain, formatTimeShort } from '../lib/format';
import { useTheme } from '../theme/ThemeProvider';
import { elev, radius, space } from '../theme/tokens';

const { width: SW, height: SH } = Dimensions.get('window');
const HERO_H = Math.min(300, SH * 0.38);

// ─── MetaRow con ícono en cápsula de color ────────────────────────────────────

function DataMetaRow({ icon, tint, title, subtitle, actionLabel, onAction, last = false }) {
  const { colors } = useTheme();
  const tintColor = {
    yellow: colors['action.primary'],
    violet: colors['nav.selected'],
    green:  colors['status.free'],
  }[tint] ?? colors['text.secondary'];

  return (
    <View style={[
      styles.metaRow,
      !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors['border.subtle'] },
    ]}>
      <View style={[styles.metaIcon, { backgroundColor: `${tintColor}22` }]}>
        <Ionicons name={icon} size={18} color={tintColor} />
      </View>
      <View style={styles.metaText}>
        <Text variant="subtitle" numberOfLines={2}>{title}</Text>
        {subtitle ? <Text variant="caption" color="text.tertiary" numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" style={styles.metaAction}>
          <Text variant="label" color="nav.selected">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ─── ExternalEventDetailScreen ────────────────────────────────────────────────

export default function ExternalEventDetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { event } = route.params;
  const [descExpanded, setDescExpanded] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!userId || !event?.id) return;
    const unsub = onSnapshot(doc(db, 'users', userId), snap => {
      setIsSaved((snap.data()?.savedExternalIds || []).includes(event.id));
    }, () => {});
    return () => unsub();
  }, [userId, event?.id]);

  if (!event) return null;

  // Datos derivados
  const hasImage   = !!event.imageUrl;
  const dateLabel  = event.dateISO
    ? formatDateLong(event.dateISO)
    : (event.dateText || '');
  const timeLabel  = formatTimeShort(event.time ?? event.eventTime ?? '');
  const daysLabel  = formatDaysUntil(event.dateISO);
  const dateSubtitle = [timeLabel, daysLabel].filter(Boolean).join(' · ');
  const domain     = formatDomain(event.eventUrl);
  const source     = event.source || 'la web';

  const handleBuy = () => {
    safeOpenURL(event.eventUrl);
  };

  const handleSave = async () => {
    if (!userId) return;
    if (!requireAccount(navigation, 'Creá una cuenta para guardar este evento en Mis planes.')) return;
    const wasSaved = isSaved;
    setIsSaved(!wasSaved);
    try {
      await toggleSavedExternal(userId, event.id);
      showSnackbar(
        wasSaved
          ? { message: 'Se quitó de Mis planes' }
          : { message: 'Guardado en Mis planes', actionLabel: 'Ver', action: () => navigation.navigate('MainApp', { screen: 'MyPlans' }) }
      );
    } catch {
      setIsSaved(wasSaved);
      showSnackbar({ message: 'No se pudo guardar. Intentá de nuevo.' });
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${event.title}\n${event.eventUrl}`,
        url: event.eventUrl,
      });
    } catch {}
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors['bg.base'] }]}>

      {/* ── HERO 300px ──────────────────────────────────────────────────── */}
      <View style={[styles.hero, { height: HERO_H }]}>
        {hasImage ? (
          <>
            {/* Fondo desenfocado */}
            <Image
              source={{ uri: event.imageUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              blurRadius={26}
            />
            {/* Overlay oscuro */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11,9,16,0.45)' }]} />
            {/* Imagen contenida */}
            <Image
              source={{ uri: event.imageUrl }}
              style={styles.heroImage}
              contentFit="contain"
            />
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors['bg.surface'], justifyContent: 'center', alignItems: 'center', padding: space[8] }]}>
            <Text variant="h2" align="center" style={{ fontFamily: 'BricolageGrotesque_700Bold' }}>
              {event.title}
            </Text>
          </View>
        )}

        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: 'rgba(255,255,255,0.35)' }]} />

        {/* Cerrar — 44px, esquina superior derecha */}
        <Pressable
          style={[styles.closeBtn, { marginTop: insets.top }]}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Cerrar"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={20} color="#fff" />
        </Pressable>
      </View>

      {/* ── CONTENIDO SCROLLEABLE ──────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* 2 · IDENTIDAD */}
        <View style={styles.badges}>
          {event.category && event.category !== 'Externo' ? (
            <StatusBadge label={event.category.toUpperCase()} variant="neutral" />
          ) : null}
          {event.soldOutSoon ? (
            <StatusBadge label="ÚLTIMAS ENTRADAS" variant="urgent" />
          ) : null}
        </View>

        <Text
          style={[styles.title, { color: colors['text.primary'], fontFamily: 'BricolageGrotesque_700Bold' }]}
          numberOfLines={3}
        >
          {event.title}
        </Text>

        {/* 3 · BLOQUE ÚNICO DE DATOS — una card, sin repetir cards */}
        <View style={[styles.dataCard, { backgroundColor: colors['bg.surface'] }, elev[1]]}>
          {/* Fecha + hora */}
          {dateLabel ? (
            <DataMetaRow
              icon="calendar-outline"
              tint="yellow"
              title={dateLabel}
              subtitle={dateSubtitle || undefined}
              actionLabel={event.dateISO ? 'Agendar' : undefined}
              onAction={event.dateISO ? () => {} : undefined}
            />
          ) : null}

          {/* Lugar */}
          {event.locationText ? (
            <DataMetaRow
              icon="location-outline"
              tint="violet"
              title={event.locationText}
              subtitle={undefined}
              actionLabel="Mapa"
              onAction={() => {}}
            />
          ) : null}

          {/* Entradas — fuente en caption, sin precio falso */}
          <DataMetaRow
            icon="ticket-outline"
            tint="green"
            title="Ver entradas"
            subtitle={`Vía ${source}`}
            last
          />
        </View>

        {/* 4 · DESCRIPCIÓN — 3 líneas colapsadas */}
        {event.description ? (
          <View style={styles.section}>
            <Text
              variant="body"
              color="text.secondary"
              numberOfLines={descExpanded ? undefined : 3}
            >
              {event.description}
            </Text>
            {!descExpanded ? (
              <Pressable onPress={() => setDescExpanded(true)} style={{ marginTop: space[2] }}>
                <Text variant="label" color="link">Ver más</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* ── 6 · BARRA DE ACCIÓN FIJA ──────────────────────────────────── */}
      {/* Antes el microcopy vivía en un View absoluto aparte, pegado al mismo
          bottom:0 que esta barra — con fondo opaco, quedaba pintado ENCIMA
          de los botones y los tapaba por completo. Ahora todo es un solo
          contenedor: los botones y el microcopy van en flujo normal adentro. */}
      <View style={[
        styles.actionBar,
        {
          backgroundColor: colors['bg.base'],
          borderTopColor:  colors['border.subtle'],
          paddingBottom: Math.max(space[3], insets.bottom),
        },
        elev[3],
      ]}>
        <View style={styles.actionBarRow}>
          {/* Guardar */}
          <Pressable
            style={[styles.iconAction, { backgroundColor: isSaved ? `${colors['action.primary']}22` : colors['bg.surface'] }]}
            onPress={handleSave}
            accessibilityLabel={isSaved ? 'Quitar de Mis planes' : 'Guardar evento'}
          >
            <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={22} color={isSaved ? colors['action.primary'] : colors['text.primary']} />
          </Pressable>

          {/* Compartir */}
          <Pressable
            style={[styles.iconAction, { backgroundColor: colors['bg.surface'] }]}
            onPress={handleShare}
            accessibilityLabel="Compartir"
          >
            <Ionicons name="share-outline" size={22} color={colors['text.primary']} />
          </Pressable>

          {/* CTA principal — amarillo, NO violeta */}
          <Pressable
            style={[styles.ctaBtn, { backgroundColor: colors['action.primary'] }]}
            onPress={handleBuy}
            accessibilityRole="button"
            accessibilityLabel="Comprar entradas"
          >
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors['text.onAction'] }}>
              Comprar entradas
            </Text>
            <Ionicons name="open-outline" size={18} color={colors['text.onAction']} />
          </Pressable>
        </View>

        {/* Microcopy debajo del CTA */}
        {domain ? (
          <Text variant="caption" color="text.tertiary" align="center" style={styles.microCopy}>
            Se abre {domain} · te guardamos el evento
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  // Hero
  hero: { position: 'relative', overflow: 'hidden' },
  heroImage: {
    position: 'absolute',
    top: 14, bottom: 14, left: 14, right: 14,
  },
  handle: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: space[4],
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 22,
  },

  // Identidad
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    paddingHorizontal: space[5],
    paddingTop: 18,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    paddingHorizontal: space[5],
    paddingTop: space[3],
    paddingBottom: space[1],
  },

  // Data card
  dataCard: {
    marginHorizontal: space[5],
    marginTop: space[4],
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[3],
    minHeight: 60,
  },
  metaIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  metaText:   { flex: 1, gap: 2 },
  metaAction: { paddingLeft: space[2] },

  // Descripción
  section: {
    paddingHorizontal: space[5],
    paddingTop: space[5],
  },

  // Action bar
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: space[5],
    paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  iconAction: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  ctaBtn: {
    flex: 1,
    height: 56,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  microCopy: {
    marginTop: space[2],
  },
});

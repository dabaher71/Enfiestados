// EventDetailScreen — Detalle de evento propio
// LÓGICA INTACTA: likes, asistencia, comentarios, eliminar, editar, compartir, chats.
// PRESENTACIÓN: diseño 4a/4b — bloque único de datos, CTA amarillo, sin ceros, sin tilde faltante.
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, Share, StyleSheet, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';

import CommentsSection from '../components/CommentsSection';
import ImageViewerModal from '../components/ImageViewerModal';
import ReportModal from '../components/ReportModal';
import Avatar from '../components/ui/Avatar';
import StatusBadge from '../components/ui/StatusBadge';
import Text from '../components/ui/Text';
import Sheet from '../components/ui/Sheet';

import { showSnackbar } from '../components/ui/Snackbar';
import { auth, db } from '../config/firebase';
import { getOrCreateChat, sendMessage } from '../services/chatService';
import { deleteEvent, toggleAttendance, toggleLike, toggleSaved } from '../services/eventService';
import { createNotification, NOTIFICATION_TYPES } from '../services/notificationService';
import { recordSignal } from '../services/signalService';
import { safeOpenURL } from '../utils/security';
import { formatDateLong, formatTimeShort } from '../lib/format';
import { useTheme } from '../theme/ThemeProvider';
import { elev, radius, space } from '../theme/tokens';

// ─── MetaRow con ícono en cápsula ────────────────────────────────────────────

function DataMetaRow({ icon, tint, title, subtitle, actionLabel, onAction, last = false, colors }) {
  const tintMap = { yellow: colors['action.primary'], violet: colors['nav.selected'], green: colors['status.free'] };
  const tintColor = tintMap[tint] ?? colors['text.secondary'];
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
        {subtitle ? <Text variant="caption" color="text.tertiary">{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" style={{ paddingLeft: space[2] }}>
          <Text variant="label" color="nav.selected">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ─── EventDetailScreen ────────────────────────────────────────────────────────

export default function EventDetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { event } = route.params;

  const [likes,          setLikes]          = useState(event.likes || []);
  const [attendees,      setAttendees]      = useState(event.attendees || []);
  const [savedBy,        setSavedBy]        = useState(event.savedBy || []);
  const [showOptions,    setShowOptions]    = useState(false);
  const [showShare,      setShowShare]      = useState(false);
  const [showReport,     setShowReport]     = useState(false);
  const [showImgViewer,  setShowImgViewer]  = useState(false);
  const [chats,          setChats]          = useState([]);
  const [loadingChats,   setLoadingChats]   = useState(false);
  const [organizerAvatar,setOrganizerAvatar]= useState(event.organizerAvatar || '');
  const [organizerName,  setOrganizerName]  = useState(event.organizerName || '');
  const [commentsState,  setCommentsState]  = useState(event.comments || []);
  const [descExpanded,   setDescExpanded]   = useState(false);
  const [descNeedsMore,  setDescNeedsMore]  = useState(false);
  const lastLoadRef = useRef(0);

  const userId     = auth.currentUser?.uid;
  const isLiked    = likes.includes(userId);
  const isAttending= attendees.includes(userId);
  const isSaved    = savedBy.includes(userId);
  const isOrganizer= userId === event.organizerId;
  const hasLocation= !!(event.location?.lat && event.location?.lng && event.location.lat !== 0);
  const eventLink  = `https://enfiestados.app/evento/${event.id}`;

  // Datos formateados
  const dateLabel  = formatDateLong(event.date);
  const timeLabel  = formatTimeShort(event.time);
  const dateSubtitle = timeLabel || undefined;

  // ── Carga ──────────────────────────────────────────────────────────────────

  const loadOrganizerAndComments = async () => {
    if (event.organizerId) {
      try {
        const orgDoc = await getDoc(doc(db, 'users', event.organizerId));
        if (orgDoc.exists()) {
          const d = orgDoc.data();
          setOrganizerAvatar(d.avatar || '');
          setOrganizerName(d.name || d.displayName || event.organizerName || '');
        }
      } catch {}
    }
    try {
      const getCommentUserId = c => c.userId || c.uid || c.authorId || c.ownerId;
      if (event.comments?.length) {
        const ids = [...new Set(event.comments.map(getCommentUserId).filter(Boolean))];
        const docs = await Promise.all(ids.map(id => getDoc(doc(db, 'users', id)).catch(() => null)));
        const map = {};
        ids.forEach((id, i) => { if (docs[i]?.exists()) map[id] = docs[i].data(); });
        setCommentsState(event.comments.map(c => {
          const id = getCommentUserId(c);
          return id && map[id] ? { ...c, avatar: map[id].avatar || c.avatar, name: map[id].name || c.name } : c;
        }));
      } else {
        setCommentsState([]);
      }
    } catch {}
  };

  useEffect(() => {
    loadOrganizerAndComments();
    lastLoadRef.current = Date.now();
    if (userId) recordSignal(userId, event, 'open');
    const unsub = navigation.addListener?.('focus', () => {
      if (Date.now() - lastLoadRef.current > 30_000) {
        loadOrganizerAndComments();
        lastLoadRef.current = Date.now();
      }
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [event, navigation]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleLike = async () => {
    try {
      const newLikes = await toggleLike(event.id, userId);
      setLikes(newLikes);
      recordSignal(userId, event, isLiked ? 'unlike' : 'like');
      if (!isLiked) await createNotification({
        type: NOTIFICATION_TYPES.LIKE,
        fromUserId: userId,
        fromUserName: auth.currentUser.displayName || auth.currentUser.email.split('@')[0],
        fromUserAvatar: auth.currentUser.photoURL || '',
        toUserId: event.organizerId,
        message: 'le dio like a tu evento',
        eventId: event.id, eventData: event,
      });
    } catch {}
  };

  const handleAttend = async () => {
    try {
      const newAttendees = await toggleAttendance(event.id, userId);
      setAttendees(newAttendees);
      recordSignal(userId, event, isAttending ? 'unattend' : 'attend');
      if (!isAttending) await createNotification({
        type: NOTIFICATION_TYPES.ATTEND,
        fromUserId: userId,
        fromUserName: auth.currentUser.displayName || auth.currentUser.email.split('@')[0],
        fromUserAvatar: auth.currentUser.photoURL || '',
        toUserId: event.organizerId,
        message: 'confirmó asistencia a tu evento',
        eventId: event.id, eventData: event,
      });
    } catch {}
  };

  // Guardar/quitar de "Mis planes" — optimista, revierte con snackbar si falla
  const handleSave = async () => {
    const wasSaved = isSaved;
    setSavedBy(prev => wasSaved ? prev.filter(id => id !== userId) : [...prev, userId]);
    try {
      const newSavedBy = await toggleSaved(event.id, userId);
      setSavedBy(newSavedBy);
      showSnackbar(
        wasSaved
          ? { message: 'Se quitó de Mis planes' }
          : { message: 'Guardado en Mis planes', actionLabel: 'Ver', action: () => navigation.navigate('MyPlans') }
      );
    } catch {
      setSavedBy(prev => wasSaved ? [...prev, userId] : prev.filter(id => id !== userId));
      showSnackbar({ message: 'No se pudo guardar. Intentá de nuevo.' });
    }
  };

  const handleDelete = () => Alert.alert(
    '¿Eliminar evento?',
    `Esta acción no se puede deshacer. Los ${attendees.length} asistentes recibirán una notificación.`,
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try { await deleteEvent(event.id, userId); navigation.goBack(); }
        catch { Alert.alert('Error', 'No se pudo eliminar'); }
      }},
    ]
  );

  const handleEdit = () => { setShowOptions(false); navigation.navigate('EditEvent', { event }); };
  const openMaps = () => {
    if (hasLocation) safeOpenURL(`https://www.google.com/maps/dir/?api=1&destination=${event.location.lat},${event.location.lng}`);
  };

  const handleShare = async () => {
    setShowShare(true);
    setLoadingChats(true);
    try {
      const snap = await getDocs(query(collection(db, 'chats'), where('participants', 'array-contains', userId)));
      const list = [];
      for (const d of snap.docs) {
        const otherId = d.data().participants.find(id => id !== userId);
        const uDoc = await getDoc(doc(db, 'users', otherId));
        if (uDoc.exists()) list.push({ id: d.id, uid: otherId, ...uDoc.data() });
      }
      setChats(list);
    } catch {}
    setLoadingChats(false);
  };

  const shareExternal = async () => {
    setShowShare(false);
    await Share.share({ message: `${event.title}\n${event.date} · ${event.location?.name || ''}\n${eventLink}`, title: event.title }).catch(() => {});
  };

  const copyLink = async () => {
    await Clipboard.setStringAsync(eventLink);
    setShowShare(false);
    Alert.alert('', 'Link copiado');
  };

  const shareToChat = async (chat) => {
    try {
      const chatData = await getOrCreateChat(userId, chat.uid);
      await sendMessage(chatData.id, userId, `Te comparto este evento: ${event.title}\n${event.date} - ${event.time}\n${eventLink}`);
      setShowShare(false);
    } catch {}
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors['bg.base'] }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        >

          {/* ── HERO ─────────────────────────────────────────────────────── */}
          <View style={styles.hero}>
            <Pressable onPress={() => event.image && setShowImgViewer(true)} activeOpacity={0.9}>
              {event.image ? (
                <Image source={{ uri: event.image }} style={styles.heroImg} contentFit="cover" transition={200} />
              ) : (
                <View style={[styles.heroImg, styles.heroPlaceholder, { backgroundColor: colors['bg.surface'] }]}>
                  <Ionicons name="image-outline" size={40} color={colors['text.tertiary']} />
                </View>
              )}
            </Pressable>
            {/* Gradiente superior para que la barra de estado sea legible (§ 1.3) */}
            <View style={[styles.heroTopGradient, { height: insets.top + 60 }]} pointerEvents="none" />

            {/* Botón atrás */}
            <Pressable
              style={[styles.heroBtn, { top: space[3] + insets.top, left: space[4] }]}
              onPress={() => navigation.goBack()}
              accessibilityLabel="Volver"
            >
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </Pressable>

            {/* Guardar (bookmark) */}
            <Pressable
              style={[styles.heroBtn, { top: space[3] + insets.top, right: space[4] + 40 + space[2] }]}
              onPress={handleSave}
              accessibilityLabel={isSaved ? 'Quitar de Mis planes' : 'Guardar en Mis planes'}
              accessibilityRole="button"
            >
              <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={20} color={isSaved ? colors['action.primary'] : '#fff'} />
            </Pressable>

            {/* Opciones (···) */}
            <Pressable
              style={[styles.heroBtn, { top: space[3] + insets.top, right: space[4] }]}
              onPress={() => setShowOptions(v => !v)}
              accessibilityLabel="Opciones"
            >
              <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
            </Pressable>

            {/* Menú opciones */}
            {showOptions && (
              <View style={[styles.optionsMenu, { backgroundColor: colors['bg.raised'], top: 52 + insets.top, right: space[4] }, elev[3]]}>
                {isOrganizer ? (
                  <>
                    <Pressable style={styles.optionItem} onPress={handleEdit}>
                      <Ionicons name="create-outline" size={18} color={colors['text.primary']} />
                      <Text variant="body">Editar evento</Text>
                    </Pressable>
                    <View style={[styles.optionDivider, { backgroundColor: colors['border.subtle'] }]} />
                    <Pressable style={styles.optionItem} onPress={handleDelete}>
                      <Ionicons name="trash-outline" size={18} color={colors['status.urgent']} />
                      <Text variant="body" style={{ color: colors['status.urgent'] }}>Eliminar</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable style={styles.optionItem} onPress={() => { setShowOptions(false); setShowReport(true); }}>
                    <Ionicons name="flag-outline" size={18} color={colors['status.urgent']} />
                    <Text variant="body" style={{ color: colors['status.urgent'] }}>Reportar</Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* Badge tipo */}
            <View style={[styles.typeBadge, { backgroundColor: event.isVirtual ? colors['status.info'] : colors['status.free'] }]}>
              <Ionicons name={event.isVirtual ? 'videocam' : 'location'} size={13} color="#fff" />
              <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#fff' }}>
                {event.isVirtual ? 'Virtual' : 'Presencial'}
              </Text>
            </View>
          </View>

          {/* ── IDENTIDAD ─────────────────────────────────────────────────── */}
          <View style={[styles.section, { paddingTop: 18 }]}>
            <View style={styles.badges}>
              {event.category && <StatusBadge label={event.category.toUpperCase()} variant="neutral" />}
              {event.isFree === true || event.price === 0
                ? <StatusBadge label="Gratis" variant="free" />
                : typeof event.price === 'number' && event.price > 0
                  ? <StatusBadge label={`₡${event.price.toLocaleString('es-CR')}`} variant="neutral" />
                  : null}
            </View>

            <Text style={[styles.title, { color: colors['text.primary'], fontFamily: 'BricolageGrotesque_700Bold' }]} numberOfLines={3}>
              {event.title}
            </Text>

            {/* Organizador */}
            <Pressable
              style={[styles.organizerRow, { backgroundColor: colors['bg.surface'] }]}
              onPress={() => navigation.navigate('UserProfile', { userId: event.organizerId })}
              accessibilityRole="button"
            >
              <Avatar uri={organizerAvatar} name={organizerName} size={40} />
              <View style={{ flex: 1, marginLeft: space[3] }}>
                <Text variant="caption" color="text.tertiary">Organizado por</Text>
                <Text variant="subtitle">{organizerName || event.organizerName}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors['text.tertiary']} />
            </Pressable>
          </View>

          {/* ── BLOQUE ÚNICO DE DATOS ─────────────────────────────────────── */}
          <View style={[styles.section]}>
            <View style={[styles.dataCard, { backgroundColor: colors['bg.surface'] }, elev[1]]}>
              {/* Fecha + hora (una sola fila) */}
              {dateLabel ? (
                <DataMetaRow
                  icon="calendar-outline" tint="yellow"
                  title={dateLabel}
                  subtitle={dateSubtitle}
                  colors={colors}
                />
              ) : null}

              {/* Lugar */}
              {hasLocation || event.location?.name ? (
                <DataMetaRow
                  icon="location-outline" tint="violet"
                  title={event.location?.name || 'Ubicación confirmada'}
                  actionLabel={hasLocation ? 'Mapa' : undefined}
                  onAction={hasLocation ? openMaps : undefined}
                  colors={colors}
                />
              ) : null}

              {/* Link virtual */}
              {event.isVirtual && event.virtualLink ? (
                <DataMetaRow
                  icon="link-outline" tint="green"
                  title="Enlace de la transmisión"
                  subtitle={event.virtualLink}
                  actionLabel="Abrir"
                  onAction={() => safeOpenURL(event.virtualLink)}
                  last
                  colors={colors}
                />
              ) : null}
            </View>
          </View>

          {/* ── MAPA (si tiene ubicación) ─────────────────────────────────── */}
          {hasLocation && (
            <View style={styles.section}>
              <View style={[styles.mapContainer, { borderRadius: radius.lg, overflow: 'hidden' }]}>
                <MapView
                  style={styles.map}
                  initialRegion={{ latitude: event.location.lat, longitude: event.location.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                >
                  <Marker coordinate={{ latitude: event.location.lat, longitude: event.location.lng }}>
                    <View style={[styles.mapMarker, { backgroundColor: colors['action.primary'] }]}>
                      <Ionicons name="location" size={18} color={colors['text.onAction']} />
                    </View>
                  </Marker>
                </MapView>
                <Pressable
                  style={[styles.directionsBtn, { backgroundColor: colors['bg.raised'] }, elev[2]]}
                  onPress={openMaps}
                  accessibilityRole="button"
                >
                  <Ionicons name="navigate-outline" size={16} color={colors['nav.selected']} />
                  <Text variant="label" color="nav.selected">Cómo llegar</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ── DESCRIPCIÓN — "Ver más" solo si el texto tiene más de 3 líneas (§ 5.2) */}
          {event.description ? (
            <View style={styles.section}>
              <Text
                variant="body"
                color="text.secondary"
                numberOfLines={descExpanded ? undefined : 3}
                onTextLayout={e => {
                  if (!descExpanded && e.nativeEvent.lines.length > 3) setDescNeedsMore(true);
                }}
              >
                {event.description}
              </Text>
              {descNeedsMore && !descExpanded && (
                <Pressable onPress={() => setDescExpanded(true)} style={{ marginTop: space[2] }}>
                  <Text variant="label" color="link">Ver más</Text>
                </Pressable>
              )}
            </View>
          ) : null}

          {/* ── PRUEBA SOCIAL — iconos outline text.secondary, "me gusta" (§ 5.4, 5.5) */}
          {(likes.length > 0 || attendees.length > 0) && (
            <View style={[styles.section, styles.statsRow]}>
              {likes.length > 0 && (
                <View style={styles.statItem}>
                  {/* Corazón relleno solo si YO di like; outline si no (§ 5.4) */}
                  <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={18} color={colors['text.secondary']} />
                  <Text variant="caption" color="text.secondary">
                    {likes.length} {likes.length === 1 ? 'me gusta' : 'me gusta'}
                  </Text>
                </View>
              )}
              {attendees.length > 0 && (
                <View style={styles.statItem}>
                  <Ionicons name="people-outline" size={18} color={colors['text.secondary']} />
                  <Text variant="caption" color="text.secondary">
                    {attendees.length} {attendees.length === 1 ? 'persona va' : 'personas van'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── BANNER "VAS A IR" — solo cuando asiste, aporta el recordatorio (§ 5.3) */}
          {isAttending && (
            <View style={[styles.section]}>
              <View style={[styles.attendingBanner, { backgroundColor: colors['status.free.bg'], borderColor: colors['status.free'] }]}>
                <Ionicons name="checkmark-circle" size={20} color={colors['status.free']} />
                <View style={{ flex: 1 }}>
                  <Text variant="subtitle" style={{ color: colors['status.free'] }}>Vas a ir</Text>
                  {event.date && (
                    <Text variant="caption" style={{ color: colors['status.free'], opacity: 0.8 }}>
                      Te recordamos el día anterior
                    </Text>
                  )}
                </View>
                <Pressable onPress={handleAttend} accessibilityRole="button">
                  <Text variant="label" style={{ color: colors['status.free'] }}>Cancelar</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ── COMENTARIOS ──────────────────────────────────────────────── */}
          <View style={styles.section}>
            <CommentsSection
              eventId={event.id}
              comments={commentsState}
              organizerId={event.organizerId}
              event={event}
              onUserPress={uid => navigation.navigate('UserProfile', { userId: uid })}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── BARRA DE ACCIÓN FIJA ─────────────────────────────────────────── */}
      <View style={[
        styles.actionBar,
        {
          backgroundColor: colors['bg.base'],
          borderTopColor: colors['border.subtle'],
          paddingBottom: Math.max(space[4], insets.bottom),
        },
        elev[3],
      ]}>
        {/* Like */}
        <Pressable
          onPress={handleLike}
          style={[styles.iconAction, { backgroundColor: isLiked ? `${colors['status.urgent']}22` : colors['bg.surface'] }]}
          accessibilityLabel={isLiked ? 'Quitar like' : 'Dar like'}
        >
          <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={22} color={isLiked ? colors['status.urgent'] : colors['text.primary']} />
        </Pressable>

        {/* CTA — amarillo "¡Voy!" cuando no asiste; secundario con check cuando sí (§ 5.3) */}
        <Pressable
          onPress={handleAttend}
          style={[
            styles.ctaBtn,
            isAttending
              ? { backgroundColor: colors['bg.surface'], borderWidth: 1.5, borderColor: colors['status.free'] }
              : { backgroundColor: colors['action.primary'] },
          ]}
          accessibilityRole="button"
          accessibilityLabel={isAttending ? 'Cancelar asistencia' : 'Confirmar asistencia'}
        >
          <Ionicons
            name={isAttending ? 'checkmark-circle-outline' : 'calendar-outline'}
            size={20}
            color={isAttending ? colors['status.free'] : colors['text.onAction']}
          />
          <Text style={{
            fontFamily: 'PlusJakartaSans_700Bold',
            fontSize: 16,
            color: isAttending ? colors['text.primary'] : colors['text.onAction'],
          }}>
            {isAttending ? 'Vas a ir' : '¡Voy!'}
          </Text>
        </Pressable>

        {/* Compartir */}
        <Pressable
          onPress={handleShare}
          style={[styles.iconAction, { backgroundColor: colors['bg.surface'] }]}
          accessibilityLabel="Compartir"
        >
          <Ionicons name="share-outline" size={22} color={colors['text.primary']} />
        </Pressable>
      </View>

      {/* ── SHEET COMPARTIR ──────────────────────────────────────────────── */}
      <Sheet visible={showShare} onClose={() => setShowShare(false)} height="half" title="Compartir">
        <View style={{ paddingHorizontal: space[5], paddingTop: space[3] }}>
          <View style={styles.shareRow}>
            {/* Compartir en — cuadrado 52px radius.md */}
            <Pressable onPress={shareExternal} style={[styles.shareBtn, { backgroundColor: colors['status.free.bg'] }]} accessibilityLabel="Compartir en...">
              <Ionicons name="share-social-outline" size={24} color={colors['status.free']} />
              <Text variant="caption" color="text.secondary" align="center">Compartir en…</Text>
            </Pressable>
            {/* Copiar enlace */}
            <Pressable onPress={copyLink} style={[styles.shareBtn, { backgroundColor: colors['bg.surface'] }]} accessibilityLabel="Copiar enlace">
              <Ionicons name="link-outline" size={24} color={colors['text.primary']} />
              <Text variant="caption" color="text.secondary" align="center">Copiar enlace</Text>
            </Pressable>
          </View>

          {/* Enviar a chat */}
          {chats.length > 0 && (
            <>
              <Text variant="caption" color="text.tertiary" style={{ marginTop: space[4], marginBottom: space[3] }}>
                Enviar a un amigo
              </Text>
              <FlatList
                data={chats}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space[3] }}
                renderItem={({ item }) => (
                  <Pressable onPress={() => shareToChat(item)} style={styles.chatChip}>
                    <Avatar uri={item.avatar} name={item.name} size={44} />
                    <Text variant="caption" color="text.secondary" align="center" numberOfLines={1} style={{ width: 60 }}>
                      {item.name?.split(' ')[0]}
                    </Text>
                  </Pressable>
                )}
              />
            </>
          )}
        </View>
      </Sheet>

      <ReportModal visible={showReport} onClose={() => setShowReport(false)} targetType="event" targetId={event.id} />
      <ImageViewerModal uri={event.image} visible={showImgViewer} onClose={() => setShowImgViewer(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  // Hero
  hero: { position: 'relative' },
  heroImg: { width: '100%', height: 260 },
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  // Overlay superior para legibilidad de status bar (§ 1.3)
  // Simula gradiente: oscuro arriba, transparente abajo
  heroTopGradient: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  heroBtn: {
    position: 'absolute',
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadge: {
    position: 'absolute',
    bottom: space[3],
    right: space[4],
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radius.full,
    gap: 4,
  },
  optionsMenu: {
    position: 'absolute',
    right: space[4],
    borderRadius: radius.lg,
    paddingVertical: space[2],
    minWidth: 160,
    zIndex: 100,
  },
  optionItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[4], paddingVertical: space[3], gap: space[3] },
  optionDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: space[4] },

  // Secciones
  section: { paddingHorizontal: space[5], paddingBottom: space[4] },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginBottom: space[3] },
  title: { fontSize: 24, lineHeight: 30, marginBottom: space[4] },

  // Organizador
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    padding: space[3],
  },

  // Data card
  dataCard: { borderRadius: radius.lg, overflow: 'hidden' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[3],
    minHeight: 60,
  },
  metaIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  metaText: { flex: 1, gap: 2 },

  // Mapa
  mapContainer: { position: 'relative' },
  map: { width: '100%', height: 160 },
  mapMarker: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  directionsBtn: {
    position: 'absolute',
    bottom: space[3],
    right: space[3],
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    gap: space[1],
  },

  // Stats
  statsRow: { flexDirection: 'row', gap: space[4] },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: space[1] },

  // Banner asistencia
  attendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: space[3],
    gap: space[3],
  },

  // Action bar
  actionBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space[2],
  },
  iconAction: {
    width: 56, height: 56,
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

  // Share sheet
  shareRow: { flexDirection: 'row', gap: space[3] },
  shareBtn: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
  },
  chatChip: { alignItems: 'center', gap: space[1] },
});

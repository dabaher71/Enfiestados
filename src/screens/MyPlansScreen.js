// MyPlansScreen — Mis planes: Voy · Guardados · Entradas
// Sesión 5: contenido real en "Voy" (eventos donde asiste el usuario).
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EmptyState from '../components/ui/EmptyState';
import EventRow from '../components/ui/EventRow';
import { SkeletonList } from '../components/ui/Skeleton';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import Text from '../components/ui/Text';

import { auth, db } from '../config/firebase';
import { toggleAttendance } from '../services/eventService';
import { recordSignal } from '../services/signalService';
import { formatEventDate, formatDaysUntil } from '../lib/format';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import t from '../i18n/es-CR.json';

const TABS = [
  { label: 'Voy',       value: 'voy' },
  { label: 'Guardados', value: 'guardados' },
  { label: 'Entradas',  value: 'entradas' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEventTs(ev) {
  const d = ev?.date;
  if (!d) return Infinity;
  const parts = d.split('/');
  if (parts.length === 3) {
    const ts = new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime();
    return isNaN(ts) ? Infinity : ts;
  }
  return Infinity;
}

function isExpired(ev) {
  try {
    const [day, month, year] = ev.date.split('/');
    const [h, m] = (ev.time || '23:59').split(':');
    return new Date(year, month - 1, day, h, m) < new Date();
  } catch { return false; }
}

function hoursUntil(ev) {
  const ts = getEventTs(ev);
  if (ts === Infinity) return Infinity;
  return (ts - Date.now()) / 3600000;
}

// Agrupa eventos por mes: "EN JULIO", "EN AGOSTO"...
const MONTHS_UPPER = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
function groupByMonth(events) {
  const map = new Map();
  const order = [];
  events.forEach(ev => {
    const parts = ev.date?.split('/');
    if (!parts || parts.length < 3) return;
    const key = `${parts[2]}-${parts[1]}`;
    const label = `EN ${MONTHS_UPPER[parseInt(parts[1]) - 1]}`;
    if (!map.has(key)) { map.set(key, { key, label, events: [] }); order.push(key); }
    map.get(key).events.push(ev);
  });
  return order.map(k => map.get(k));
}

// ─── TicketCard — tarjeta boleto con gradiente y perforación ─────────────────

function TicketCard({ event, onPress, onMore, colors }) {
  const dateStr  = formatEventDate(event.date, event.time);
  const daysStr  = formatDaysUntil(event.date) ?? '';
  const isSoon   = hoursUntil(event) <= 3 && hoursUntil(event) >= 0;

  return (
    <Pressable onPress={onPress} style={styles.ticketWrap} accessibilityRole="button">
      {/* Aviso "EMPIEZA EN N HORAS" */}
      {isSoon && (
        <View style={[styles.urgentBanner, { backgroundColor: colors['status.urgent.bg'] }]}>
          <View style={[styles.urgentDot, { backgroundColor: colors['status.urgent'] }]} />
          <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: 1.2, color: colors['status.urgent'] }}>
            EMPIEZA EN {Math.ceil(hoursUntil(event))} HORA{Math.ceil(hoursUntil(event)) > 1 ? 'S' : ''}
          </Text>
        </View>
      )}

      {/* Tarjeta con gradiente amarillo */}
      <View style={[styles.ticket, { backgroundColor: '#FFC94A' }]}>
        <View style={styles.ticketBody}>
          {event.image ? (
            <Image source={{ uri: event.image }} style={styles.ticketThumb} contentFit="cover" />
          ) : (
            <View style={[styles.ticketThumb, styles.ticketThumbEmpty, { backgroundColor: '#F2A93B' }]}>
              <Ionicons name="calendar" size={24} color="#17131F" />
            </View>
          )}
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: 1, color: '#7A5500' }}>
              {event.category?.toUpperCase() ?? ''}
            </Text>
            <Text style={{ fontSize: 19, fontFamily: 'BricolageGrotesque_700Bold', color: '#17131F', lineHeight: 24 }} numberOfLines={2}>
              {event.title}
            </Text>
            <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#7A5500' }} numberOfLines={1}>
              {event.location?.name || ''}
            </Text>
          </View>
        </View>

        {/* Línea perforada */}
        <View style={styles.perforation}>
          <View style={[styles.perfCircle, styles.perfCircleLeft,  { backgroundColor: colors['bg.base'] }]} />
          <View style={styles.perfLine} />
          <View style={[styles.perfCircle, styles.perfCircleRight, { backgroundColor: colors['bg.base'] }]} />
        </View>

        {/* Pie del ticket */}
        <View style={styles.ticketFoot}>
          <View style={styles.ticketFootDate}>
            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#7A5500' }}>FECHA</Text>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#17131F' }}
            >
              {dateStr}
            </Text>
          </View>
          {daysStr ? (
            <View style={[styles.daysChip, { backgroundColor: '#F2A93B' }]}>
              <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#17131F' }}>{daysStr}</Text>
            </View>
          ) : null}
        </View>

        {/* Acciones del ticket */}
        <View style={styles.ticketActions}>
          <Pressable style={styles.ticketAction} onPress={() => {}} accessibilityLabel="Cómo llegar">
            <Ionicons name="navigate-outline" size={16} color="#7A5500" />
            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#7A5500' }}>Cómo llegar</Text>
          </Pressable>
          <Pressable style={styles.ticketAction} onPress={() => {}} accessibilityLabel="Compartir">
            <Ionicons name="share-outline" size={16} color="#7A5500" />
            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#7A5500' }}>Compartir</Text>
          </Pressable>
          <Pressable style={[styles.ticketAction, styles.ticketActionMore]} onPress={onMore} accessibilityLabel="Más opciones">
            <Ionicons name="ellipsis-horizontal" size={16} color="#7A5500" />
            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#7A5500' }}>Más</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

// ─── MyPlansScreen ────────────────────────────────────────────────────────────

export default function MyPlansScreen({ navigation }) {
  const { colors } = useTheme();
  const [tab,         setTab]         = useState('voy');
  const [attending,   setAttending]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [saved,       setSaved]       = useState([]);
  const [savedLoading,setSavedLoading]= useState(true);

  const userId = auth.currentUser?.uid;

  // Carga eventos donde el usuario asiste (en tiempo real)
  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    const q = query(
      collection(db, 'events'),
      where('attendees', 'array-contains', userId),
      orderBy('date', 'asc')
    );
    const unsub = onSnapshot(q, snap => {
      const evs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(e => !isExpired(e))
        .sort((a, b) => getEventTs(a) - getEventTs(b));
      setAttending(evs);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [userId]);

  // Carga eventos guardados por el usuario (bookmarks, § 4.3)
  useEffect(() => {
    if (!userId) { setSavedLoading(false); return; }
    const q = query(
      collection(db, 'events'),
      where('savedBy', 'array-contains', userId),
      orderBy('date', 'asc')
    );
    const unsub = onSnapshot(q, snap => {
      const evs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => getEventTs(a) - getEventTs(b));
      setSaved(evs);
      setSavedLoading(false);
    }, () => setSavedLoading(false));
    return () => unsub();
  }, [userId]);

  const groups      = useMemo(() => groupByMonth(attending), [attending]);
  const savedGroups = useMemo(() => groupByMonth(saved), [saved]);

  const handleMore = (ev) => {
    Alert.alert(ev.title, undefined, [
      {
        text: 'Cancelar asistencia',
        style: 'destructive',
        onPress: async () => {
          try {
            await toggleAttendance(ev.id, userId);
            recordSignal(userId, ev, 'unattend');
          } catch {}
        },
      },
      { text: 'Ver evento', onPress: () => navigation.navigate('EventDetail', { event: ev }) },
      { text: 'Cerrar', style: 'cancel' },
    ]);
  };

  const renderVoy = () => {
    if (loading) return <SkeletonList count={3} />;
    if (attending.length === 0) {
      return (
        <EmptyState
          icon={<Ionicons name="calendar-outline" size={28} color={colors['text.tertiary']} />}
          title={t.myPlans.empty.going.title}
          description={t.myPlans.empty.going.desc}
          actionLabel={t.myPlans.empty.going.action}
          onAction={() => navigation.navigate('Explore')}
        />
      );
    }

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space[16] }}>
        {/* Próximo evento como TicketCard */}
        {attending[0] && (
          <TicketCard
            event={attending[0]}
            onPress={() => navigation.navigate('EventDetail', { event: attending[0] })}
            onMore={() => handleMore(attending[0])}
            colors={colors}
          />
        )}

        {/* Resto agrupados por mes */}
        {groups.map(group => (
          group.events.length > 1 || group.events[0]?.id !== attending[0]?.id ? (
            <View key={group.key}>
              <View style={[styles.monthHeader, { borderBottomColor: colors['border.subtle'] }]}>
                <Text variant="overline" color="text.tertiary">{group.label}</Text>
              </View>
              {group.events
                .filter(e => e.id !== attending[0]?.id)
                .map(ev => (
                  <EventRow
                    key={ev.id}
                    event={ev}
                    trailing="auto"
                    onPress={() => navigation.navigate('EventDetail', { event: ev })}
                  />
                ))}
            </View>
          ) : null
        ))}
      </ScrollView>
    );
  };

  const renderGuardados = () => {
    if (savedLoading) return <SkeletonList count={3} />;
    if (saved.length === 0) {
      return (
        <EmptyState
          icon={<Ionicons name="bookmark-outline" size={28} color={colors['text.tertiary']} />}
          title={t.myPlans.empty.saved.title}
          description={t.myPlans.empty.saved.desc}
          actionLabel={t.myPlans.empty.saved.action}
          onAction={() => navigation.navigate('Explore')}
        />
      );
    }

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space[16] }}>
        {savedGroups.map(group => (
          <View key={group.key}>
            <View style={[styles.monthHeader, { borderBottomColor: colors['border.subtle'] }]}>
              <Text variant="overline" color="text.tertiary">{group.label}</Text>
            </View>
            {group.events.map(ev => (
              <EventRow
                key={ev.id}
                event={ev}
                trailing="auto"
                onPress={() => navigation.navigate('EventDetail', { event: ev })}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderEmpty = (key) => (
    <EmptyState
      icon={<Ionicons name="ticket-outline" size={28} color={colors['text.tertiary']} />}
      title={t.myPlans.empty[key]?.title ?? 'Sin contenido'}
      description={t.myPlans.empty[key]?.desc}
      actionLabel={t.myPlans.empty[key]?.action}
      onAction={() => navigation.navigate('Explore')}
    />
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="h2">{t.myPlans.title}</Text>
        {tab === 'voy' && attending.length > 0 && (
          <View style={[styles.countBadge, { backgroundColor: colors['action.primary'] }]}>
            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: colors['text.onAction'] }}>
              {attending.length}
            </Text>
          </View>
        )}
        {tab === 'guardados' && saved.length > 0 && (
          <View style={[styles.countBadge, { backgroundColor: colors['action.primary'] }]}>
            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: colors['text.onAction'] }}>
              {saved.length}
            </Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={[styles.tabsWrap, { borderBottomColor: colors['border.subtle'] }]}>
        <SegmentedControl options={TABS} selected={tab} onSelect={setTab} />
      </View>

      {/* Contenido */}
      {tab === 'voy'       ? renderVoy()            : null}
      {tab === 'guardados' ? renderGuardados()      : null}
      {tab === 'entradas'  ? renderEmpty('tickets') : null}
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[5], paddingVertical: space[4], gap: space[2] },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, minWidth: 24, alignItems: 'center' },
  tabsWrap: { paddingHorizontal: space[5], paddingBottom: space[3], borderBottomWidth: StyleSheet.hairlineWidth },

  // Aviso urgente
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingVertical: space[2],
    gap: space[2],
    marginBottom: space[1],
  },
  urgentDot: { width: 8, height: 8, borderRadius: 4 },

  // Ticket card
  ticketWrap: { marginHorizontal: space[5], marginTop: space[4] },
  ticket: {
    borderRadius: radius.lg,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  ticketBody: {
    flexDirection: 'row',
    padding: space[4],
    gap: space[3],
    alignItems: 'flex-start',
  },
  ticketThumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    overflow: 'hidden',
    flexShrink: 0,
  },
  ticketThumbEmpty: { alignItems: 'center', justifyContent: 'center' },

  // Perforación
  perforation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: -1,
  },
  perfCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginHorizontal: -8,
    zIndex: 2,
  },
  perfCircleLeft:  {},
  perfCircleRight: {},
  perfLine: {
    flex: 1,
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },

  // Pie del ticket
  ticketFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingTop: space[3],
    paddingBottom: space[2],
    gap: space[2],
  },
  ticketFootDate: { flex: 1, flexShrink: 1 },
  daysChip: {
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radius.full,
    flexShrink: 0,
  },

  // Acciones del ticket
  ticketActions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.15)',
  },
  ticketAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
    paddingVertical: space[3],
  },
  ticketActionMore: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(0,0,0,0.15)',
  },

  // Grupos por mes
  monthHeader: {
    paddingHorizontal: space[5],
    paddingTop: space[5],
    paddingBottom: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: space[5],
  },
});

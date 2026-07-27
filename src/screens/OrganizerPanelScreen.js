// OrganizerPanelScreen — Herramientas de organizador (§ 13c)
// Stats de eventos organizados + opción de promoción.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import EventRow from '../components/ui/EventRow';
import MetaRow from '../components/ui/MetaRow';
import { SkeletonList } from '../components/ui/Skeleton';
import Text from '../components/ui/Text';

import { auth } from '../config/firebase';
import { subscribeToEvents } from '../services/eventService';
import { useTheme } from '../theme/ThemeProvider';
import { elev, radius, space } from '../theme/tokens';

export default function OrganizerPanelScreen({ navigation }) {
  const { colors } = useTheme();
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);

  const userId = auth.currentUser?.uid;

  useEffect(() => {
    const unsub = subscribeToEvents(all => {
      setEvents(all.filter(e => e.organizerId === userId));
      setLoading(false);
    });
    return () => unsub?.();
  }, [userId]);

  const isExpired = e => {
    try {
      const [d, m, y] = e.date.split('/');
      const [h, min] = (e.time || '23:59').split(':');
      return new Date(y, m - 1, d, h, min) < new Date();
    } catch { return false; }
  };

  const active = useMemo(() =>
    events.filter(e => !isExpired(e)).sort((a, b) => {
      const p = ev => { const [d,m,y] = ev.date.split('/'); return new Date(y,m-1,d); };
      return p(a) - p(b);
    }),
  [events]);

  const expired = useMemo(() =>
    events.filter(e => isExpired(e)).sort((a, b) => {
      const p = ev => { const [d,m,y] = ev.date.split('/'); return new Date(y,m-1,d); };
      return p(b) - p(a); // más reciente primero
    }),
  [events]);

  // Stats agregadas
  const totalAttendees = events.reduce((s, e) => s + (e.attendees?.length ?? 0), 0);
  const totalLikes     = events.reduce((s, e) => s + (e.likes?.length ?? 0), 0);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={colors['text.primary']} />
        </Pressable>
        <Text variant="h2">Herramientas</Text>
        <Button
          variant="primary"
          size="sm"
          label="Crear"
          leadingIcon={<Ionicons name="add" size={16} color={colors['text.onAction']} />}
          onPress={() => navigation.navigate('CreateEvent')}
        />
      </View>

      {loading ? <SkeletonList count={4} /> : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space[16] }}>

          {/* Stats resumen */}
          {events.length > 0 && (
            <View style={[styles.statsCard, { backgroundColor: colors['bg.surface'] }, elev[1]]}>
              {[
                { label: 'Eventos',    value: events.length,   icon: 'calendar-outline' },
                { label: 'Asistentes', value: totalAttendees,  icon: 'people-outline' },
                { label: 'Likes',      value: totalLikes,      icon: 'heart-outline' },
              ].map((s, i) => (
                <View key={i} style={[styles.statItem, i < 2 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors['border.subtle'] }]}>
                  <Ionicons name={s.icon} size={20} color={colors['action.primary']} />
                  <Text style={{ fontSize: 22, fontFamily: 'BricolageGrotesque_700Bold', color: colors['text.primary'] }}>
                    {s.value > 999 ? `${(s.value/1000).toFixed(1)}k` : s.value}
                  </Text>
                  <Text variant="caption" color="text.tertiary">{s.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Promoción */}
          <View style={[styles.promoCard, { backgroundColor: `${colors['action.primary']}18`, borderColor: `${colors['action.primary']}44` }]}>
            <View style={styles.promoContent}>
              <Ionicons name="megaphone-outline" size={24} color={colors['action.primary']} />
              <View style={{ flex: 1 }}>
                <Text variant="title">Promové tu evento</Text>
                <Text variant="caption" color="text.secondary" style={{ marginTop: 3 }}>
                  Llegá a más personas con una campaña dentro de la app.
                </Text>
              </View>
            </View>
            <Button
              variant="primary"
              size="sm"
              label="Ver opciones"
              onPress={() => navigation.navigate('AdvertiserRequest')}
              style={{ marginTop: space[3] }}
            />
          </View>

          {/* Acceso a Centro de Anuncios (si ya es anunciante) */}
          <View style={[styles.section, { backgroundColor: colors['bg.surface'] }]}>
            <MetaRow
              icon={<Ionicons name="stats-chart-outline" size={20} color={colors['nav.selected']} />}
              label="Centro de Anuncios"
              value="Métricas de tus campañas"
              onPress={() => navigation.navigate('AdCenter')}
            />
            <MetaRow
              icon={<Ionicons name="create-outline" size={20} color={colors['text.secondary']} />}
              label="Editar un evento"
              value="Seleccioná el evento a modificar"
              onPress={() => {}}
            />
          </View>

          {/* Eventos activos */}
          {active.length > 0 && (
            <>
              <View style={[styles.sectionHeader, { borderBottomColor: colors['border.subtle'] }]}>
                <View style={[styles.dot, { backgroundColor: colors['status.free'] }]} />
                <Text variant="overline" color="text.tertiary">ACTIVOS · {active.length}</Text>
              </View>
              {active.map(ev => (
                <View key={ev.id}>
                  <EventRow
                    event={ev}
                    trailing="auto"
                    onPress={() => navigation.navigate('EventDetail', { event: ev })}
                  />
                  {/* Mini-stats del evento */}
                  <View style={[styles.eventStats, { borderBottomColor: colors['border.subtle'] }]}>
                    <View style={styles.miniStat}>
                      <Ionicons name="people-outline" size={14} color={colors['status.free']} />
                      <Text variant="caption" color="text.tertiary">{ev.attendees?.length ?? 0} van</Text>
                    </View>
                    <View style={styles.miniStat}>
                      <Ionicons name="heart-outline" size={14} color={colors['status.urgent']} />
                      <Text variant="caption" color="text.tertiary">{ev.likes?.length ?? 0}</Text>
                    </View>
                    <View style={styles.miniStat}>
                      <Ionicons name="chatbubble-outline" size={14} color={colors['text.tertiary']} />
                      <Text variant="caption" color="text.tertiary">{ev.comments?.length ?? 0}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Eventos pasados */}
          {expired.length > 0 && (
            <>
              <View style={[styles.sectionHeader, { borderBottomColor: colors['border.subtle'] }]}>
                <View style={[styles.dot, { backgroundColor: colors['text.tertiary'] }]} />
                <Text variant="overline" color="text.tertiary">PASADOS · {expired.length}</Text>
              </View>
              {expired.slice(0, 5).map(ev => (
                <View key={ev.id} style={{ opacity: 0.55 }}>
                  <EventRow event={ev} trailing="auto" onPress={() => navigation.navigate('EventDetail', { event: ev })} />
                </View>
              ))}
            </>
          )}

          {events.length === 0 && (
            <EmptyState
              icon={<Ionicons name="calendar-outline" size={28} color={colors['text.tertiary']} />}
              title="Sin eventos todavía"
              description="Creá tu primer evento y empezá a recibir asistentes."
              actionLabel="Crear evento"
              onAction={() => navigation.navigate('CreateEvent')}
            />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[5], paddingVertical: space[4], gap: space[3] },
  back:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  statsCard: {
    flexDirection: 'row',
    marginHorizontal: space[5],
    marginBottom: space[4],
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space[4],
    gap: 3,
  },

  promoCard: {
    marginHorizontal: space[5],
    marginBottom: space[4],
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: space[4],
  },
  promoContent: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },

  section: { marginHorizontal: space[5], borderRadius: radius.lg, overflow: 'hidden', marginBottom: space[4] },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    gap: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },

  eventStats: {
    flexDirection: 'row',
    paddingHorizontal: space[5],
    paddingBottom: space[3],
    gap: space[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  miniStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});

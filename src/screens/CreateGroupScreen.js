// CreateGroupScreen — armar un grupo de chat.
// Los candidatos salen del grafo social del usuario (a quién sigue + quién lo
// sigue), sin repetidos y sin los bloqueados en ninguna dirección.
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { SkeletonList } from '../components/ui/Skeleton';
import Text from '../components/ui/Text';

import { auth, db } from '../config/firebase';
import useBlockedUsers from '../hooks/useBlockedUsers';
import { createGroupChat, MAX_GROUP_PARTICIPANTS } from '../services/chatService';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';

export default function CreateGroupScreen({ navigation }) {
  const { colors } = useTheme();
  const userId = auth.currentUser?.uid;
  const { allBlocked } = useBlockedUsers();

  const [name,        setName]        = useState('');
  const [writePolicy, setWritePolicy] = useState('all');
  const [candidates,  setCandidates]  = useState(null); // null = cargando
  const [selected,    setSelected]    = useState(new Set());
  const [creating,    setCreating]    = useState(false);
  const [nameError,   setNameError]   = useState('');

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      try {
        const me = await getDoc(doc(db, 'users', userId));
        const data = me.data() ?? {};
        const ids = [...new Set([...(data.following ?? []), ...(data.followers ?? [])])]
          .filter(id => id !== userId);

        const docs = await Promise.all(
          ids.map(id => getDoc(doc(db, 'users', id)).catch(() => null))
        );
        if (cancelled) return;

        const people = [];
        ids.forEach((id, i) => {
          if (docs[i]?.exists()) people.push({ id, ...docs[i].data() });
        });
        people.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
        setCandidates(people);
      } catch {
        if (!cancelled) setCandidates([]);
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  // El bloqueo se resuelve acá y no al guardar: alguien bloqueado no debería
  // ni aparecer como opción.
  const visible = useMemo(
    () => (candidates ?? []).filter(p => !allBlocked.has(p.id)),
    [candidates, allBlocked]
  );

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size + 1 >= MAX_GROUP_PARTICIPANTS) {
        Alert.alert('Límite alcanzado', `Un grupo admite hasta ${MAX_GROUP_PARTICIPANTS} personas.`);
        return prev;
      } else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name.trim()) { setNameError('Poné un nombre al grupo'); return; }
    if (selected.size === 0) { Alert.alert('Sin miembros', 'Elegí al menos una persona.'); return; }

    setCreating(true);
    try {
      const chatId = await createGroupChat(userId, name, [...selected], writePolicy);
      // replace y no navigate: si el usuario toca atrás desde el chat recién
      // creado, tiene que volver a Mensajes y no al formulario.
      navigation.replace('ChatDetail', { chatId, isGroup: true });
    } catch (e) {
      Alert.alert('No se pudo crear', e?.message ?? 'Intentá de nuevo.');
      setCreating(false);
    }
  };

  const renderPerson = ({ item }) => {
    const on = selected.has(item.id);
    return (
      <Pressable
        onPress={() => toggle(item.id)}
        style={[styles.row, { borderBottomColor: colors['border.subtle'] }]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
      >
        <Avatar uri={item.avatar} name={item.name} size={44} />
        <Text variant="title" numberOfLines={1} style={styles.rowName}>{item.name ?? 'Usuario'}</Text>
        <View style={[
          styles.check,
          on
            ? { backgroundColor: colors['action.primary'], borderColor: colors['action.primary'] }
            : { borderColor: colors['border.strong'] },
        ]}>
          {on && <Ionicons name="checkmark" size={15} color={colors['text.onAction']} />}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={colors['text.primary']} />
        </Pressable>
        <Text variant="h2" style={{ flex: 1 }}>Nuevo grupo</Text>
      </View>

      <View style={styles.form}>
        <Input
          label="Nombre del grupo"
          placeholder="Ej. Viernes de amigos"
          value={name}
          onChangeText={v => { setName(v); setNameError(''); }}
          maxLength={60}
          errorText={nameError}
        />

        <Text variant="overline" color="text.tertiary" style={{ marginTop: space[5], marginBottom: space[2] }}>
          QUIÉN PUEDE ESCRIBIR
        </Text>
        <SegmentedControl
          options={[
            { label: 'Todos',   value: 'all' },
            { label: 'Solo yo', value: 'owner' },
          ]}
          selected={writePolicy}
          onSelect={setWritePolicy}
        />
        <Text variant="caption" color="text.tertiary" style={{ marginTop: space[2] }}>
          {writePolicy === 'all'
            ? 'Cualquier miembro puede mandar mensajes.'
            : 'Solo vos podés escribir — el resto solo lee. Útil para avisos de un evento.'}
        </Text>

        <Text variant="overline" color="text.tertiary" style={{ marginTop: space[5] }}>
          MIEMBROS {selected.size > 0 ? `· ${selected.size}` : ''}
        </Text>
      </View>

      {candidates === null ? (
        <SkeletonList count={5} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="people-outline" size={28} color={colors['text.tertiary']} />}
          title="Todavía no seguís a nadie"
          description="Seguí a otras personas para poder armar un grupo con ellas."
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={p => p.id}
          renderItem={renderPerson}
          contentContainerStyle={{ paddingBottom: space[16] }}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {visible.length > 0 && (
        <View style={[styles.footer, { backgroundColor: colors['bg.base'], borderTopColor: colors['border.subtle'] }]}>
          <Button
            variant="primary"
            size="lg"
            label={selected.size > 0 ? `Crear grupo · ${selected.size}` : 'Crear grupo'}
            loading={creating}
            disabled={selected.size === 0}
            onPress={handleCreate}
            fullWidth
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[5], paddingVertical: space[4], gap: space[3] },
  back:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  form:   { paddingHorizontal: space[5], paddingBottom: space[3] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    gap: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 64,
  },
  rowName: { flex: 1 },
  check: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: space[5],
    paddingTop: space[3],
    paddingBottom: space[5],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

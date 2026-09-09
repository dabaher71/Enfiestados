// BlockedUsersScreen — lista de usuarios bloqueados, con opción de desbloquear.
// Es la única forma de revertir un bloqueo una vez que HomeScreen/SearchScreen/
// CommentsSection/Chat dejan de mostrar a esa persona en cualquier lado.
import { Ionicons } from '@expo/vector-icons';
import { arrayRemove, doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/Skeleton';
import Text from '../components/ui/Text';

import { auth, db } from '../config/firebase';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';

export default function BlockedUsersScreen({ navigation }) {
  const { colors } = useTheme();
  const userId = auth.currentUser?.uid;

  const [blockedIds, setBlockedIds] = useState(null); // null = todavía no cargó
  const [profiles,   setProfiles]   = useState({});
  const [unblocking, setUnblocking] = useState(null);

  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, 'users', userId), snap => {
      setBlockedIds(snap.data()?.usuariosBloqueados || []);
    });
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    if (!blockedIds || blockedIds.length === 0) return;
    const missing = blockedIds.filter(id => !profiles[id]);
    if (missing.length === 0) return;

    Promise.all(missing.map(id => getDoc(doc(db, 'users', id)).catch(() => null)))
      .then(docs => {
        const next = {};
        missing.forEach((id, i) => { if (docs[i]?.exists()) next[id] = docs[i].data(); });
        setProfiles(prev => ({ ...prev, ...next }));
      });
  }, [blockedIds]);

  const handleUnblock = (targetId, name) => {
    Alert.alert('Desbloquear', `¿Desbloquear a ${name}? Podrá volver a seguirte y ver tu contenido.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desbloquear',
        onPress: async () => {
          setUnblocking(targetId);
          try {
            await updateDoc(doc(db, 'users', userId), { usuariosBloqueados: arrayRemove(targetId) });
          } catch {
            Alert.alert('Error', 'No se pudo desbloquear. Intentá de nuevo.');
          }
          setUnblocking(null);
        },
      },
    ]);
  };

  const renderItem = ({ item: id }) => {
    const profile = profiles[id];
    return (
      <View style={[styles.row, { borderBottomColor: colors['border.subtle'] }]}>
        <Avatar uri={profile?.avatar} name={profile?.name} size={44} />
        <Text variant="title" numberOfLines={1} style={styles.name}>
          {profile?.name || 'Usuario'}
        </Text>
        <Button
          variant="secondary"
          size="sm"
          label="Desbloquear"
          loading={unblocking === id}
          onPress={() => handleUnblock(id, profile?.name || 'este usuario')}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={colors['text.primary']} />
        </Pressable>
        <Text variant="h2">Usuarios bloqueados</Text>
      </View>

      {blockedIds === null ? (
        <SkeletonList count={4} />
      ) : blockedIds.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="ban-outline" size={28} color={colors['text.tertiary']} />}
          title="No bloqueaste a nadie"
          description="Los usuarios que bloqueés van a aparecer acá."
        />
      ) : (
        <FlatList
          data={blockedIds}
          keyExtractor={id => id}
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[5], paddingVertical: space[4], gap: space[3] },
  back:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    gap: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { flex: 1 },
});

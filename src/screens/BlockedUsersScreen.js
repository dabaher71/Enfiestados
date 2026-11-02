// BlockedUsersScreen — lista de usuarios bloqueados, con opción de desbloquear.
// Es la única forma de revertir un bloqueo una vez que HomeScreen/SearchScreen/
// CommentsSection/Chat dejan de mostrar a esa persona en cualquier lado.
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/Skeleton';
import Text from '../components/ui/Text';

import { auth, db } from '../config/firebase';
import { subscribeToMyBlocks, unblockUser } from '../services/blockService';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { useTranslation } from 'react-i18next';

export default function BlockedUsersScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const userId = auth.currentUser?.uid;

  const [blockedIds, setBlockedIds] = useState(null); // null = todavía no cargó
  const [profiles,   setProfiles]   = useState({});
  const [unblocking, setUnblocking] = useState(null);

  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeToMyBlocks(userId, setBlockedIds);
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
    Alert.alert(t('userProfile.unblock'), t('blocked.unblockMsg', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('userProfile.unblock'),
        onPress: async () => {
          setUnblocking(targetId);
          try {
            await unblockUser(userId, targetId);
          } catch {
            Alert.alert(t('common.error'), t('blocked.unblockError'));
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
          {profile?.name || t('profile.user')}
        </Text>
        <Button
          variant="secondary"
          size="sm"
          label={t('userProfile.unblock')}
          loading={unblocking === id}
          onPress={() => handleUnblock(id, profile?.name || t('blocked.thisUser'))}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel={t('common.back')}>
          <Ionicons name="arrow-back" size={24} color={colors['text.primary']} />
        </Pressable>
        <Text variant="h2">{t('blocked.title')}</Text>
      </View>

      {blockedIds === null ? (
        <SkeletonList count={4} />
      ) : blockedIds.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="ban-outline" size={28} color={colors['text.tertiary']} />}
          title={t('blocked.emptyTitle')}
          description={t('blocked.emptyDesc')}
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

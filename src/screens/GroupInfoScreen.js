// GroupInfoScreen — miembros y administración de un grupo.
// El dueño puede renombrar, cambiar quién escribe y sacar gente. Cualquier
// otro miembro solo ve la lista y puede salirse.
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { SkeletonList } from '../components/ui/Skeleton';
import Text from '../components/ui/Text';

import { auth, db } from '../config/firebase';
import { removeParticipant, updateGroupSettings } from '../services/chatService';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { useTranslation } from 'react-i18next';

export default function GroupInfoScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { chatId } = route.params;
  const userId = auth.currentUser?.uid;

  const [chat,    setChat]    = useState(null);
  const [members, setMembers] = useState({});
  const [name,    setName]    = useState('');
  const [saving,  setSaving]  = useState(false);

  const isOwner = chat?.ownerId === userId;

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'chats', chatId), snap => {
      if (!snap.exists()) { navigation.goBack(); return; }
      const data = { id: snap.id, ...snap.data() };
      setChat(data);
      // Solo se siembra el campo la primera vez: si no, pisaría lo que el
      // dueño está escribiendo cada vez que llega un snapshot.
      setName(prev => (prev === '' ? (data.name ?? '') : prev));
    }, () => {});
    return () => unsub();
  }, [chatId]);

  useEffect(() => {
    if (!chat?.participants?.length) return;
    const missing = chat.participants.filter(id => !members[id]);
    if (!missing.length) return;

    let cancelled = false;
    Promise.all(missing.map(id => getDoc(doc(db, 'users', id)).catch(() => null)))
      .then(docs => {
        if (cancelled) return;
        const next = {};
        missing.forEach((id, i) => { if (docs[i]?.exists()) next[id] = docs[i].data(); });
        if (Object.keys(next).length) setMembers(prev => ({ ...prev, ...next }));
      });
    return () => { cancelled = true; };
  }, [chat?.participants]);

  const handleRename = async () => {
    if (!name.trim() || name.trim() === chat?.name) return;
    setSaving(true);
    try { await updateGroupSettings(chatId, { name }); }
    catch (e) { Alert.alert(t('group.saveError'), e?.message ?? t('chat.tryAgain')); }
    setSaving(false);
  };

  const handlePolicy = async (value) => {
    if (value === (chat?.writePolicy ?? 'all')) return;
    try { await updateGroupSettings(chatId, { writePolicy: value }); }
    catch { Alert.alert(t('common.error'), t('group.policyError')); }
  };

  const handleRemove = (id, memberName) => {
    Alert.alert(t('group.removeTitle'), t('group.removeMsg', { name: memberName }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('group.remove'), style: 'destructive',
        onPress: async () => {
          try { await removeParticipant(chatId, id); }
          catch { Alert.alert(t('common.error'), t('group.removeError')); }
        },
      },
    ]);
  };

  const handleLeave = () => {
    Alert.alert(
      t('group.leaveTitle'),
      t('group.leaveMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('group.leave'), style: 'destructive',
          onPress: async () => {
            try {
              await removeParticipant(chatId, userId);
              // Los chats viven en la pestaña Mensajes de Alertas.
              navigation.navigate('MainApp', { screen: 'Notifications', params: { tab: 'mensajes' } });
            } catch { Alert.alert(t('common.error'), t('group.leaveError')); }
          },
        },
      ]
    );
  };

  const renderMember = ({ item: id }) => {
    const m = members[id] ?? {};
    const owner = id === chat?.ownerId;
    return (
      <View style={[styles.row, { borderBottomColor: colors['border.subtle'] }]}>
        <Pressable onPress={() => id !== userId && navigation.navigate('UserProfile', { userId: id })}>
          <Avatar uri={m.avatar} name={m.name} size={44} />
        </Pressable>
        <View style={styles.rowText}>
          <Text variant="title" numberOfLines={1}>
            {id === userId ? t('group.you') : (m.name ?? t('profile.user'))}
          </Text>
          {owner && <Text variant="caption" color="text.tertiary">{t('group.createdGroup')}</Text>}
        </View>
        {isOwner && !owner && (
          <Pressable onPress={() => handleRemove(id, m.name ?? t('group.thisPerson'))} hitSlop={8}>
            <Ionicons name="remove-circle-outline" size={22} color={colors['status.urgent']} />
          </Pressable>
        )}
      </View>
    );
  };

  if (!chat) {
    return (
      <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
        <SkeletonList count={6} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors['bg.base'] }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel={t('common.back')}>
          <Ionicons name="arrow-back" size={24} color={colors['text.primary']} />
        </Pressable>
        <Text variant="h2" style={{ flex: 1 }} numberOfLines={1}>{t('group.info')}</Text>
      </View>

      <FlatList
        data={chat.participants ?? []}
        keyExtractor={id => id}
        renderItem={renderMember}
        contentContainerStyle={{ paddingBottom: space[16] }}
        ListHeaderComponent={
          <View style={styles.top}>
            <View style={styles.identity}>
              <Avatar name={chat.name} size={88} />
              {!isOwner && (
                <Text variant="h2" align="center" style={{ marginTop: space[3] }}>{chat.name}</Text>
              )}
            </View>

            {isOwner && (
              <>
                <Input
                  label={t('group.name')}
                  value={name}
                  onChangeText={setName}
                  maxLength={60}
                  style={{ marginTop: space[5] }}
                />
                {name.trim() !== chat.name && name.trim() !== '' && (
                  <Button
                    variant="secondary" size="sm" label={t('group.saveName')}
                    loading={saving} onPress={handleRename}
                    style={{ marginTop: space[2], alignSelf: 'flex-start' }}
                  />
                )}

                <Text variant="overline" color="text.tertiary" style={{ marginTop: space[5], marginBottom: space[2] }}>
                  {t('group.whoCanWrite')}
                </Text>
                <SegmentedControl
                  options={[
                    { label: t('group.everyone'), value: 'all' },
                    { label: t('group.onlyMe'),   value: 'owner' },
                  ]}
                  selected={chat.writePolicy ?? 'all'}
                  onSelect={handlePolicy}
                />
                <Text variant="caption" color="text.tertiary" style={{ marginTop: space[2] }}>
                  {(chat.writePolicy ?? 'all') === 'all'
                    ? t('group.everyoneDesc')
                    : t('group.onlyMeDesc')}
                </Text>
              </>
            )}

            <Text variant="overline" color="text.tertiary" style={{ marginTop: space[6], marginBottom: space[1] }}>
              {t('group.membersCount', { count: chat.participants?.length ?? 0 })}
            </Text>
          </View>
        }
        ListFooterComponent={
          !isOwner ? (
            <View style={{ paddingHorizontal: space[5], paddingTop: space[6] }}>
              <Button variant="destructive" size="md" label={t('group.leaveTitle')} onPress={handleLeave} fullWidth />
            </View>
          ) : (
            // El dueño no puede salirse: las reglas exigen que siga en
            // participants. Para irse habría que transferir el grupo, que
            // todavía no existe.
            <View style={{ paddingHorizontal: space[5], paddingTop: space[6] }}>
              <Text variant="caption" color="text.tertiary" align="center">
                {t('group.ownerCantLeave')}
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[5], paddingVertical: space[4], gap: space[3] },
  back:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  top:    { paddingHorizontal: space[5] },
  identity: { alignItems: 'center', paddingTop: space[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    gap: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 64,
  },
  rowText: { flex: 1 },
});

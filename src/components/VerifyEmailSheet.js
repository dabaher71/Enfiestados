// VerifyEmailSheet — confirmar el correo con el código de 6 dígitos que manda
// sendVerificationEmail (desde noreply@enfiestados.net). Se usa desde
// Configuración y antes de publicar un evento o una publicación.
import { httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from './ui/Button';
import Input from './ui/Input';
import Sheet from './ui/Sheet';
import Text from './ui/Text';

import { auth, functions } from '../config/firebase';
import { refreshVerifiedToken } from '../lib/emailVerification';
import { space } from '../theme/tokens';

// reason: 'publish' muestra por qué se pide (venía de tocar Publicar).
// sendOnOpen: manda un correo al abrir. Si se mandó uno hace menos de un
// minuto la función lo rechaza y no pasa nada: sigue sirviendo ese código.
export default function VerifyEmailSheet({ visible, onClose, onVerified, reason, sendOnOpen = true }) {
  const { t } = useTranslation();
  const [code,    setCode]    = useState('');
  const [error,   setError]   = useState('');
  const [notice,  setNotice]  = useState('');
  const [loading, setLoading] = useState(false);
  const email = auth.currentUser?.email;

  const send = async ({ silent }) => {
    if (!silent) { setLoading(true); setError(''); setNotice(''); }
    try {
      const { data } = await httpsCallable(functions, 'sendVerificationEmail')();
      if (data?.alreadyVerified) {
        await auth.currentUser?.reload().catch(() => {});
        await refreshVerifiedToken();
        finish(false);
      } else if (!silent) {
        setNotice(t('settings.verifyResent'));
      }
    } catch (e) {
      if (!silent) {
        setError(e?.code === 'functions/resource-exhausted' ? t('settings.verifyWait') : t('settings.verifySendError'));
      }
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    if (!visible) { setCode(''); setError(''); setNotice(''); return; }
    if (sendOnOpen) send({ silent: true });
  }, [visible]);

  const finish = (showAlert) => {
    onClose?.();
    onVerified?.(showAlert);
  };

  const confirm = async () => {
    if (code.length !== 6) { setError(t('settings.enterSixDigits')); return; }
    setLoading(true);
    setError('');
    setNotice('');
    try {
      await httpsCallable(functions, 'verifyEmailCode')({ code });
      await auth.currentUser?.reload().catch(() => {});
      await refreshVerifiedToken();
      setLoading(false);
      finish(true);
      return;
    } catch (e) {
      const msg = {
        'functions/permission-denied':  t('settings.verifyWrong'),
        'functions/deadline-exceeded':  t('settings.verifyExpired'),
        'functions/not-found':          t('settings.verifyExpired'),
        'functions/resource-exhausted': t('settings.verifyTooMany'),
      }[e?.code];
      setError(msg || t('settings.confirmError'));
    }
    setLoading(false);
  };

  return (
    <Sheet visible={visible} onClose={onClose} height="half" title={t(reason === 'publish' ? 'settings.verifyToPublish' : 'settings.verifyEmail')}>
      <View style={styles.body}>
        <Text variant="body" color="text.secondary">
          {reason === 'publish' ? `${t('settings.verifyToPublishMsg')} ` : ''}{t('settings.verifyIntro', { email })}
        </Text>
        <Input
          label={t('settings.codeLabel')}
          placeholder="000000"
          value={code}
          onChangeText={v => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError(''); }}
          keyboardType="number-pad"
          maxLength={6}
          errorText={error}
          style={{ marginTop: space[4] }}
        />
        <Button
          size="md"
          label={t('settings.verifyConfirm')}
          loading={loading}
          onPress={confirm}
          style={{ marginTop: space[4] }}
        />
        {notice ? (
          <Text variant="caption" color="text.secondary" align="center" style={{ marginTop: space[3] }}>{notice}</Text>
        ) : null}
        <Pressable onPress={() => send({ silent: false })} disabled={loading} style={{ marginTop: space[3], alignSelf: 'center' }}>
          <Text variant="caption" color="text.tertiary">{t('settings.verifyResend')}</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[8] },
});

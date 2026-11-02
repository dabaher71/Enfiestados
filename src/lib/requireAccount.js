// requireAccount — corta acciones que escriben datos (guardar, asistir, dar
// like, comentar, seguir, crear evento/publicación) cuando quien las intenta
// es un usuario anónimo (§ 8a: "sin muro de login" — se navega sin cuenta,
// pero se pide cuenta recién cuando el usuario quiere hacer algo que persiste).
// Uso: if (!requireAccount(navigation, 'Creá una cuenta para guardar eventos')) return;
import { Alert } from 'react-native';
import { auth } from '../config/firebase';
import i18n from '../i18n';

export function requireAccount(navigation, message) {
  if (!auth.currentUser?.isAnonymous) return true;
  Alert.alert(
    i18n.t('requireAccount.title'),
    message ?? i18n.t('requireAccount.default'),
    [
      { text: i18n.t('requireAccount.notNow'), style: 'cancel' },
      { text: i18n.t('auth.createAccount'), onPress: () => navigation.navigate('Register') },
    ]
  );
  return false;
}

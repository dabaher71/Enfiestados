// requireAccount — corta acciones que escriben datos (guardar, asistir, dar
// like, comentar, seguir, crear evento/publicación) cuando quien las intenta
// es un usuario anónimo (§ 8a: "sin muro de login" — se navega sin cuenta,
// pero se pide cuenta recién cuando el usuario quiere hacer algo que persiste).
// Uso: if (!requireAccount(navigation, 'Creá una cuenta para guardar eventos')) return;
import { Alert } from 'react-native';
import { auth } from '../config/firebase';

export function requireAccount(navigation, message = 'Creá una cuenta para continuar.') {
  if (!auth.currentUser?.isAnonymous) return true;
  Alert.alert(
    'Creá tu cuenta',
    message,
    [
      { text: 'Ahora no', style: 'cancel' },
      { text: 'Crear cuenta', onPress: () => navigation.navigate('Register') },
    ]
  );
  return false;
}

import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Comprueba si el entorno actual soporta push notifications.
 * Devuelve false en:
 *   - Expo Go Android (SDK 53+ no soporta push remoto)
 *   - Simuladores iOS/Android
 *   - Builds nativos con Push Notifications capability desactivada (Apple ID gratuito)
 */
const isPushSupported = async () => {
  // Expo Go en Android — no soportado desde SDK 53
  if (Constants.appOwnership === 'expo' && Platform.OS === 'android') return false;

  try {
    const { default: Device } = await import('expo-device');

    // Simuladores nunca pueden registrarse para push
    if (!Device.isDevice) return false;

    const Notifications = await import('expo-notifications');
    const { status } = await Notifications.getPermissionsAsync();

    // 'denied' o 'undetermined' sin capability = push no disponible
    return status === 'granted';
  } catch {
    return false;
  }
};

// Registrar dispositivo para push notifications
export const registerForPushNotifications = async (userId) => {
  try {
    if (!(await isPushSupported())) return null;

    const Notifications = await import('expo-notifications');

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Permiso de push no concedido.');
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });

    return token;
  } catch (e) {
    // Captura errores de entitlement faltante sin crashear la app
    console.warn('registerForPushNotifications: no disponible —', e?.message || e);
    return null;
  }
};

// Enviar notificación push (solo desde servidor — aquí es no-op)
export const sendPushNotification = async (_expoPushToken, _title, _body, _data = {}) => {
  // La notificación push real se envía desde el backend, no desde el cliente
};

// Listeners seguros — siempre devuelven un objeto con .remove()
// La implementación real requiere Push Notifications capability activa en Xcode.
export const addNotificationReceivedListener = (_callback) => {
  return { remove: () => {} };
};

export const addNotificationResponseListener = (_callback) => {
  return { remove: () => {} };
};

export const getLastNotificationResponse = async () => null;

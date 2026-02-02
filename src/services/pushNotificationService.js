import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Detectar Expo Go y desactivar comportamiento de notificaciones
const isExpoGo = Constants.appOwnership === 'expo' && Platform.OS === 'android';

if (isExpoGo) {
  console.log('pushNotificationService: Expo Go detectado — notificaciones deshabilitadas (stubs).');
}

// Registrar dispositivo para push notifications (stub en Expo Go)
export const registerForPushNotifications = async (userId) => {
  if (isExpoGo) return null;
  // En builds reales se puede reactivar la implementación con import('expo-notifications') aquí
  return null;
};

// Enviar notificación push (no-op en Expo Go)
export const sendPushNotification = async (expoPushToken, title, body, data = {}) => {
  if (isExpoGo) return;
  // Implementación real desde servidor/dev build
};

// Escuchar notificaciones recibidas (devuelve un handler "remover" no-op)
export const addNotificationReceivedListener = (callback) => {
  if (isExpoGo) {
    console.log('addNotificationReceivedListener: stub (Expo Go).');
    return { remove: () => {} };
  }
  // Implementación real cuando se active expo-notifications
  return { remove: () => {} };
};

// Escuchar cuando el usuario toca una notificación (no-op en Expo Go)
export const addNotificationResponseListener = (callback) => {
  if (isExpoGo) {
    console.log('addNotificationResponseListener: stub (Expo Go).');
    return { remove: () => {} };
  }
  return { remove: () => {} };
};

// Obtener la última notificación que abrió la app (stub)
export const getLastNotificationResponse = async () => {
  if (isExpoGo) return null;
  return null;
};

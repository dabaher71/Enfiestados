import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState, Platform, StatusBar } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';

// Configurar cómo se muestran las notificaciones
// Notifications.setNotificationHandler({
//   handleNotification: async () => ({
//     shouldShowAlert: true,
//     shouldPlaySound: true,
//     shouldSetBadge: true,
//   }),
// });

export default function App() {
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // Escuchar notificaciones recibidas (app abierta)
    // No configurar listeners ni registro de push en Expo Go (Android),
    // porque expo-notifications remotas fueron removidas de Expo Go en SDK 53.
    // if (!(Constants.appOwnership === 'expo' && Platform.OS === 'android')) {
    //   notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
    //     console.log('Notificación recibida:', notification);
    //   });

    //   // Escuchar cuando el usuario toca una notificación
    //   responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
    //     console.log('Usuario tocó notificación:', response);
    //   });
    //   // Si tienes función registerForPushNotifications, llámala solo aquí
    //   // await registerForPushNotifications(userId);
    // } else {
    //   console.log('Omitiendo registro de push en Expo Go (Android). Usa un build para probar push).');
    // }

    // Sólo cargar expo-notifications en runtime si no estamos en Expo Go (Android)
    let notificationsModule;
    (async () => {
      try {
        if (!(Constants.appOwnership === 'expo' && Platform.OS === 'android')) {
          notificationsModule = await import('expo-notifications');
          notificationListener.current = notificationsModule.addNotificationReceivedListener(n => {
            console.log('Notificación recibida:', n);
          });
          responseListener.current = notificationsModule.addNotificationResponseReceivedListener(r => {
            console.log('Usuario tocó notificación:', r);
          });
          // Si tienes registerForPushNotifications en un servicio que usa expo-notifications,
          // llama a esa función aquí (asegúrate de que el servicio importe expo-notifications dinámicamente).
        } else {
          console.log('Omitiendo expo-notifications en Expo Go (Android). Usa un dev build para probar push.');
        }
      } catch (e) {
        console.warn('No se pudieron inicializar notificaciones:', e?.message || e);
      }
    })();

    return () => {
      if (notificationListener.current?.remove) notificationListener.current.remove();
      if (responseListener.current?.remove) responseListener.current.remove();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const checkUpdate = async () => {
      try {
        // No ejecutar en Expo Go (no soportado) — sólo en builds EAS / standalone
        if (Constants.appOwnership === 'expo') return;
        const { isAvailable } = await Updates.checkForUpdateAsync();
        if (isAvailable) {
          await Updates.fetchUpdateAsync();
          // opcional: mostrar prompt antes de reload
          await Updates.reloadAsync();
        }
      } catch (e) {
        // silenciar errores cuando no esté disponible (por ejemplo Expo Go)
        console.warn('Update check skipped or failed:', e?.message || e);
      }
    };

    const sub = AppState.addEventListener('change', state => {
      if (!mounted) return;
      if (state === 'active') {
        checkUpdate();
      }
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      <AppNavigator />
    </>
  );
}

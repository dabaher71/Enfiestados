import Constants from 'expo-constants';
import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState, Platform, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { SnackbarProvider } from './src/components/ui/Snackbar';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { sanitizeError } from './src/utils/security';

// Override global: evita que objetos Firebase completos (con tokens, configs)
// se logueen accidentalmente en producción.
if (!__DEV__) {
  const _origError = console.error;
  console.error = (...args) => {
    const safe = args.map(a =>
      a instanceof Error || (a && typeof a === 'object' && a.code) ? sanitizeError(a) : a
    );
    _origError(...safe);
  };
}

// Configurar cómo se muestran las notificaciones
// Notifications.setNotificationHandler({
//   handleNotification: async () => ({
//     shouldShowAlert: true,
//     shouldPlaySound: true,
//     shouldSetBadge: true,
//   }),
// });

export default function App() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

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
    (async () => {
      try {
        // Omitir en Expo Go Android (no soportado desde SDK 53)
        if (Constants.appOwnership === 'expo' && Platform.OS === 'android') {
          console.log('expo-notifications omitido en Expo Go Android.');
          return;
        }

        // Verificar que el dispositivo soporte notificaciones push antes de cargar el módulo
        const { default: Device } = await import('expo-device');
        if (!Device.isDevice) {
          // Simulador: no puede registrarse para push
          console.log('expo-notifications omitido en simulador.');
          return;
        }

        const notificationsModule = await import('expo-notifications');

        // Verificar permisos antes de añadir listeners (evita crash si capability está desactivada)
        const { status } = await notificationsModule.getPermissionsAsync();
        if (status === 'undetermined' || status === 'denied') {
          // Sin permiso o sin capability — añadir solo listeners locales es seguro,
          // pero registrar para push token crasheará; no lo hacemos.
          console.log('Push Notifications no disponibles en este dispositivo/cuenta.');
          return;
        }

        notificationListener.current = notificationsModule.addNotificationReceivedListener(n => {
          console.log('Notificación recibida:', n);
        });
        responseListener.current = notificationsModule.addNotificationResponseReceivedListener(r => {
          console.log('Usuario tocó notificación:', r);
        });
      } catch (e) {
        // Captura errores de entitlement faltante (NSCocoaErrorDomain 3000) u otros
        console.warn('Push Notifications no disponibles:', e?.message || e);
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

  // Esperar fuentes antes de renderizar (evita flash con fuente del sistema)
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
      <ThemeProvider>
        <SnackbarProvider>
          <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
          <AppNavigator />
        </SnackbarProvider>
      </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

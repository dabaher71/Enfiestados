// Crashlytics — deshabilitado en __DEV__ para no ensuciar reportes con
// errores de desarrollo (Fast Refresh, warnings de libs, etc.).
import crashlytics from '@react-native-firebase/crashlytics';

export function recordError(error, context) {
  if (__DEV__) {
    console.error('[crashReporting]', context, error);
    return;
  }
  try {
    if (context) crashlytics().log(context);
    crashlytics().recordError(error instanceof Error ? error : new Error(String(error)));
  } catch {}
}

export function setCrashUser(uid) {
  if (__DEV__) return;
  try { crashlytics().setUserId(uid || ''); } catch {}
}

// Los crashes fatales no pasan por React (ErrorBoundary) — hay que engancharse
// al handler global de JS para que también lleguen a Crashlytics.
export function installGlobalErrorHandler() {
  if (__DEV__) return;
  const defaultHandler = global.ErrorUtils?.getGlobalHandler?.();
  if (!defaultHandler) return;

  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    recordError(error, isFatal ? 'fatal' : 'non-fatal');
    defaultHandler(error, isFatal);
  });
}

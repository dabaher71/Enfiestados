// app.config.js reemplaza a app.json para poder leer la Google Maps API key
// desde una variable de entorno en vez de tenerla hardcodeada en un archivo
// versionado. Ver .env.example — copiá ese archivo a .env con tu key real
// para desarrollo local, y `eas secret:create` para builds en la nube.
//
// Android e iOS usan keys SEPARADAS: cada una se restringe en Google Cloud
// Console a un solo bundle/package + su SHA-1 o cert, así que la key de
// Android no sirve para iOS y viceversa.
const googleMapsApiKeyAndroid = process.env.GOOGLE_MAPS_API_KEY_ANDROID;
const googleMapsApiKeyIOS = process.env.GOOGLE_MAPS_API_KEY_IOS;

if (!googleMapsApiKeyAndroid) {
  console.warn(
    '[app.config.js] GOOGLE_MAPS_API_KEY_ANDROID no está seteada — el mapa no va a funcionar en Android. ' +
    'Copiá .env.example a .env y poné tu key ahí.'
  );
}
if (!googleMapsApiKeyIOS) {
  console.warn(
    '[app.config.js] GOOGLE_MAPS_API_KEY_IOS no está seteada — el mapa no va a funcionar en iOS.'
  );
}

module.exports = {
  expo: {
    name: 'Enfiestados',
    slug: 'enfiestados-app',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/logo.png',
    userInterfaceStyle: 'dark',
    splash: {
      image: './assets/images/logo.png',
      resizeMode: 'contain',
      backgroundColor: '#1a1a2e',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      // Antes decía 'com.david.enfiestados' — no coincidía con el bundle ID
      // ya registrado en Firebase (app iOS) ni con el cliente OAuth de
      // Google Sign-In para iOS, ambos configurados con 'com.enfiestados.app'
      // (el mismo package que Android). No hay nada en App Store Connect
      // todavía atado al valor viejo, así que se corrige acá en vez de volver
      // a registrar todo en Firebase/Google Cloud con el ID equivocado.
      bundleIdentifier: 'com.enfiestados.app',
      buildNumber: '7',
      googleServicesFile: './GoogleService-Info.plist',
      config: {
        googleMapsApiKey: googleMapsApiKeyIOS,
      },
      infoPlist: {
        CFBundleURLTypes: [
          { CFBundleURLSchemes: ['com.googleusercontent.apps.211216248478-3h0pjmcm66d8bf59r6m6eh0aeiagbk7h'] },
        ],
        NSCameraUsageDescription: 'Necesitamos acceso a tu cámara para tomar fotos de eventos y perfil',
        NSPhotoLibraryUsageDescription: 'Necesitamos acceso a tu galería para subir fotos de eventos y perfil',
        NSLocationWhenInUseUsageDescription: 'Necesitamos tu ubicación para mostrar eventos cercanos',
        NSLocationAlwaysAndWhenInUseUsageDescription: 'Necesitamos tu ubicación para mostrar eventos cercanos',
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/logo.png',
        backgroundColor: '#1a1a2e',
      },
      package: 'com.enfiestados.app',
      // Requerido por @react-native-firebase/app (Crashlytics) — antes no
      // estaba referenciado acá, así que nunca se copiaba al proyecto nativo
      // ni se aplicaba el Google Services Gradle plugin.
      googleServicesFile: './google-services.json',
      config: {
        googleMaps: {
          apiKey: googleMapsApiKeyAndroid,
        },
      },
      // RECORD_AUDIO se quitó: la app no graba ni reproduce audio, y el
      // selector de imágenes está limitado a MediaTypeOptions.Images. Un
      // permiso sensible declarado y sin usar aparece como "Grabar audio" en
      // la ficha de Play y es motivo de preguntas en la revisión.
      permissions: [
        'android.permission.CAMERA',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
      ],
    },
    updates: {
      enabled: true,
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0,
      url: 'https://u.expo.dev/97e444bc-19fc-4a33-bca2-f2eecedd7471',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    plugins: [
      [
        'react-native-google-mobile-ads',
        {
          androidAppId: 'ca-app-pub-5363568499936245~8795174061',
          iosAppId: 'ca-app-pub-5363568499936245~8795174061',
        },
      ],
      // Las cuentas gratuitas de Apple (Personal Team) no pueden firmar la
      // capability de Push Notifications: el entitlement `aps-environment`
      // que agrega este plugin hace fallar la firma al correr en un
      // dispositivo real desde Xcode. Con EXPO_NO_PUSH=1 se omite el plugin
      // (el módulo nativo sigue autolinkeado — solo se saca el entitlement).
      // Sin la variable, o sea en los builds de EAS/producción, las push
      // quedan intactas. En runtime, pushNotificationService.isPushSupported()
      // ya contempla este caso y no crashea.
      process.env.EXPO_NO_PUSH === '1' ? null : 'expo-notifications',
      [
        'expo-image-picker',
        {
          photosPermission: 'Necesitamos acceso a tu galería para subir fotos',
          cameraPermission: 'Necesitamos acceso a tu cámara para tomar fotos',
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission: 'Necesitamos tu ubicación para mostrar eventos cercanos',
        },
      ],
      'expo-updates',
      'expo-font',
      'expo-router',
      '@react-native-google-signin/google-signin',
      // Crashlytics: reportes de crashes en producción, Android e iOS.
      '@react-native-firebase/app',
      '@react-native-firebase/crashlytics',
      [
        'expo-build-properties',
        {
          // static + $RNFirebaseDisableSPM (ver plugins/withPodfileStaticFrameworkFix.js)
          // es la combinación que linkea bien con AdMob y react-native-maps.
          // buildReactNativeFromSource evita otro conflicto del React-Core
          // precompilado (nuevo en RN 0.81) con este mismo setup.
          ios: { useFrameworks: 'static', buildReactNativeFromSource: true },
        },
      ],
      './plugins/withPodfileStaticFrameworkFix',
      // Último en la lista a propósito: borra el entitlement de push que
      // agrega expo-notifications, así que tiene que correr después de él.
      './plugins/withOptionalPushEntitlement',
    ].filter(Boolean),
    notification: {
      icon: './assets/images/logo.png',
      color: '#6c5ce7',
      androidMode: 'default',
      androidCollapsedTitle: 'Enfiestados',
    },
    extra: {
      router: {},
      eas: {
        projectId: '97e444bc-19fc-4a33-bca2-f2eecedd7471',
      },
    },
    owner: 'dabaher22',
  },
};

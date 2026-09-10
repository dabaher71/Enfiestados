const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Historia (ver commits): probamos frameworks dinámicos porque
// react-native-firebase resuelve Firebase vía Swift Package Manager, que
// choca con linkage estático. Pero react-native-maps y el SDK de AdMob
// (xcframeworks estáticos precompilados: Google-Mobile-Ads-SDK,
// GoogleUserMessagingPlatform) no linkean bien como frameworks dinámicos —
// CocoaPods no propaga correctamente las flags de link de esos vendored
// frameworks hacia el framework dinámico que los consume (RNGoogleMobileAds).
//
// Es más simple ir al revés: desactivar SPM en react-native-firebase (usa
// CocoaPods clásico para Firebase en su lugar) y volver a linkage estático
// para todo — así todo se linkea de una sola vez al binario final de la app,
// que es exactamente como ya funcionaban react-native-maps y AdMob.
// use_modular_headers! resuelve aparte el único problema real del modo
// estático (AppCheckCore, un pod Swift, necesita module maps para sus
// dependencias ObjC GoogleUtilities/RecaptchaInterop).
//
// Expo regenera ios/Podfile en cada `expo prebuild`, así que este parche no
// puede vivir como una edición manual — tiene que reinyectarse como plugin.
const PATCH_MARKER = 'RNFirebaseDisableSPM';
const PATCH = `
# Enfiestados — ver plugins/withPodfileStaticFrameworkFix.js
$RNFirebaseDisableSPM = true
use_modular_headers!
`;

module.exports = function withPodfileStaticFrameworkFix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfilePath, 'utf8');
      if (!contents.includes(PATCH_MARKER)) {
        fs.writeFileSync(podfilePath, PATCH + '\n' + contents);
      }
      return config;
    },
  ]);
};

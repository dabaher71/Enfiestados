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

// Xcode 27 solo acepta deployment targets de iOS 15.0 en adelante, pero
// varios pods (sobre todo sus targets de resource bundles / privacy
// manifests: GoogleSignIn, AdMob, react-native-maps, SDWebImage, nanopb…)
// siguen declarando 9.0–13.4, y la compilación falla con
// "The iOS deployment target 'IPHONEOS_DEPLOYMENT_TARGET' is set to 12.0,
// but the range of supported deployment target versions is 15.0 to 27.x".
// Se sube todo pod que esté por debajo al mínimo de la app (el `platform`
// del Podfile, 15.1). Va después de react_native_post_install para que nada
// lo pise.
//
// En el mismo bloque: fmt 11.0.2 (dependencia de React Native vía Folly) no
// compila con el Clang de Xcode 27 en C++20 — "call to consteval function
// 'fmt::basic_format_string<…>' is not a constant expression" en
// format-inl.h. fmt no deja apagar consteval con una macro (FMT_USE_CONSTEVAL
// se define sin #ifndef), así que se compila solo ese target en C++17, donde
// fmt no usa consteval. El resto de los pods sigue en C++20.
const MIN_TARGET_MARKER = 'EnfiestadosMinDeploymentTarget';
const MIN_IOS_TARGET = '15.1';
const MIN_TARGET_PATCH = `
    # ${MIN_TARGET_MARKER} — ver plugins/withPodfileStaticFrameworkFix.js
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || current.to_f < ${MIN_IOS_TARGET}
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_IOS_TARGET}'
        end
        if target.name == 'fmt'
          build_config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        end
      end
    end
`;

// Inserta MIN_TARGET_PATCH justo después de la llamada a
// react_native_post_install(...) dentro del post_install existente (un
// Podfile admite un solo post_install).
function addMinDeploymentTarget(contents) {
  if (contents.includes(MIN_TARGET_MARKER)) return contents;
  const call = contents.indexOf('react_native_post_install(');
  if (call === -1) throw new Error('withPodfileStaticFrameworkFix: no se encontró react_native_post_install en el Podfile');
  const close = contents.indexOf('\n    )\n', call);
  if (close === -1) throw new Error('withPodfileStaticFrameworkFix: no se encontró el cierre de react_native_post_install');
  const at = close + '\n    )\n'.length;
  return contents.slice(0, at) + MIN_TARGET_PATCH + contents.slice(at);
}

function patchPodfile(contents) {
  let next = contents;
  if (!next.includes(PATCH_MARKER)) next = PATCH + '\n' + next;
  return addMinDeploymentTarget(next);
}

module.exports = function withPodfileStaticFrameworkFix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfilePath, 'utf8');
      const next = patchPodfile(contents);
      if (next !== contents) fs.writeFileSync(podfilePath, next);
      return config;
    },
  ]);
};

module.exports.patchPodfile = patchPodfile;

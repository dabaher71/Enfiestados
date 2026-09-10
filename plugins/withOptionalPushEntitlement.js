const { withEntitlementsPlist } = require('@expo/config-plugins');

// Las cuentas gratuitas de Apple (Personal Team) no pueden firmar la
// capability de Push Notifications — el entitlement `aps-environment` hace
// fallar la firma con "Personal development teams do not support the Push
// Notifications capability" al correr en un dispositivo real desde Xcode.
//
// No alcanza con sacar 'expo-notifications' de la lista de plugins: Expo
// aplica su config plugin igual por autolinking. Hay que borrar el
// entitlement después, que es lo que hace esto.
//
// Con EXPO_NO_PUSH=1 se quita. Sin la variable (builds de EAS/producción)
// las push quedan intactas. En runtime,
// pushNotificationService.isPushSupported() ya contempla la ausencia del
// entitlement y devuelve false sin crashear.
module.exports = function withOptionalPushEntitlement(config) {
  if (process.env.EXPO_NO_PUSH !== '1') return config;

  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment'];
    return config;
  });
};

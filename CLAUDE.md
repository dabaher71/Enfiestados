# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start       # Start Expo dev server
npm run android     # Run on Android emulator/device
npm run ios         # Run on iOS simulator
npm run lint        # ESLint (expo lint)
```

Builds use EAS:
```bash
eas build --platform android --profile preview   # APK for testing
eas build --platform android --profile production
eas update                                        # OTA update push
```

## Architecture

**Stack**: React Native + Expo (~54), Firebase (Auth, Firestore, Storage), React Navigation v7

**Entry point**: `index.js` → `App.js` (handles push notifications + OTA updates) → `src/navigation/AppNavigator.js`

**Navigation flow**:
- `AppNavigator` (Stack) — checks `onAuthStateChanged()` with 1.5s splash delay
  - Unauthenticated: Login / Register screens
  - Authenticated: `TabNavigator` (Home, Search, CreateEvent, Notifications, Profile) + modal stack screens (EventDetail, UserProfile, EditProfile, Chats, ChatDetail, EditEvent, Settings, CreatePost)

**Source structure** (`src/`):
- `screens/` — 17 screen components, all styles inline (StyleSheet.create at bottom of each file)
- `components/` — EventCard, PostCard, CommentsSection, SkeletonLoader, NativeAdCard, LoadingScreen
- `services/` — Firebase operations: `eventService.js`, `postService.js`, `chatService.js`, `notificationService.js`, `pushNotificationService.js`
- `navigation/` — AppNavigator.js, TabNavigator.js
- `config/firebase.js` — Firebase init with AsyncStorage persistence

**State management**: No global store. Each screen uses local `useState` + Firestore `onSnapshot()` real-time listeners. Auth state flows from AppNavigator down via navigation params.

**Firestore collections**: `users`, `events`, `posts`, `chats`, `messages`, `notifications`, `blocks`

**Privacidad de `users/{uid}`**: cualquier usuario autenticado (invitados incluidos) lee cualquier perfil, así que ahí NO van datos privados. El email vive solo en Firebase Auth; los bloqueos viven en `blocks/{blockerId}_{blockedId}` (`blockService.js`, `useBlockedUsers`). Las reglas rechazan `email` y `usuariosBloqueados` en `users`.

**Zona y distancia**: `src/lib/zonePreference.js` guarda `{ lat, lng, radiusKm }` en AsyncStorage (no en `users/{uid}`, que es público: el pin suele ser la casa del usuario). `useZonePreference()` avisa a todas las pantallas al guardar; `isInZone(ev, zone)` filtra el feed del Inicio (los virtuales siempre entran, los que no tienen coordenadas no). Se edita en `ZoneSettingsScreen` (Configuración o la ubicación del header del Inicio).

**Mensajes**: la lista de chats es la pestaña "Mensajes" de NotificationsScreen (componente `ChatList`), no una pantalla aparte. Para abrirla desde otra pantalla: `navigate('MainApp', { screen: 'Notifications', params: { tab: 'mensajes' } })`.

**Borrado de cuenta**: `deleteAllUserData` en `functions/index.js` limpia Firestore + Storage. Cualquier colección o carpeta de Storage nueva con datos de usuario tiene que agregarse ahí.

**Key service patterns**:
- All service functions are standalone (not class-based)
- Real-time subscriptions return unsubscribe functions (call in `useEffect` cleanup)
- Image uploads go to Firebase Storage, URL stored in Firestore doc

## App Details

- **Theme**: design system en `src/theme/` — tokens en `tokens.js` (`darkColors`/`lightColors`, `space`, `radius`, `font`, `elev`, `motion`), consumidos vía `useTheme()` de `ThemeProvider`. Dark: `bg.base` `#17131F`, `nav.selected` `#8B6BFF`. **No hardcodear hex ni `fontSize`** — usar los tokens y el componente `src/components/ui/Text.js` (variantes: display/h1/h2/h3/title/subtitle/body/bodyStrong/label/caption/overline/tabLabel). La paleta vieja (`#1a1a2e`, `#6c5ce7`) está deprecada.
- **Idiomas**: español (original, voseo tico), inglés, francés y portugués (Brasil), con i18next. Textos en `src/i18n/{es,en,fr,pt}.json`; config en `src/i18n/index.js` (`setLanguage`, `LANGUAGES`, `intlLocale()`). Se elige en Configuración → Idioma y en el registro (`components/LanguagePicker.js`); se guarda en AsyncStorage (`appLanguage`), y la primera vez se toma el idioma del teléfono. **Ningún texto visible va escrito en el código**: en componentes `const { t } = useTranslation()`, fuera de React `i18n.t(...)` (y el componente que lo muestra tiene que llamar a `useTranslation()` para re-renderizar al cambiar de idioma). Al agregar una clave, agregarla en los cuatro archivos. Sin plurales de i18next (`_one`/`_other`): Hermes no garantiza `Intl.PluralRules`; usar dos claves (`xOne`/`xMany`). Las notificaciones se muestran según su `type` (`alerts.types.*`) en el idioma de quien las lee; el campo `message` guardado queda solo como respaldo. Lo que escriben los usuarios no se traduce. Siguen solo en español: AdminScreen, DevCatalogScreen y las pantallas de anuncios (AdCenter, CreateAd, AdvertiserRequest, OrganizerPanel), que hoy solo se ven en desarrollo.
- **Ads**: AdMob `ca-app-pub-5363568499936245~8795174061` — NativeAdCard component
- **Notifications**: In-app (notificationService) + push (pushNotificationService + expo-notifications)
- **Firebase project**: `enfiestados-alpha`
- **EAS project**: `97e444bc-19fc-4a33-bca2-f2eecedd7471`

## Safe area y tab bar

Las pantallas de tab (Home, Explore, MyPlans, Notifications, Profile) **no deben
aplicar el safe-area inferior**: la tab bar de `MainTabNavigator` ya lo reserva
dentro de su propia altura (`60 + insets.bottom`). `@react-navigation/bottom-tabs`
solo *consume* el contexto de insets para dimensionar la barra — nunca lo
sobreescribe para las pantallas —, así que un `useSafeAreaInsets().bottom` o un
`<SafeAreaView>` sin `edges` dentro de una pantalla de tab cuenta el inset dos
veces y deja una banda muerta sobre la barra que recorta botones y texto.

- Pantalla de tab → `<SafeAreaView edges={['top']}>`, y nunca sumar
  `insets.bottom` a un `contentContainerStyle` ni a un overlay `absolute bottom:0`.
- Pantalla de stack (Settings, EventDetail, etc.) → `<SafeAreaView>` normal, con
  borde inferior, porque ahí no hay tab bar.
- Toda lista scrolleable con tab bar lleva `paddingBottom` (`space[6]` o más) para
  que el último ítem no quede al ras del borde de la barra.

## Platform Notes

- Android notch/padding handled manually in each screen (Settings, Notifications, CreateEvent, Chat)
- `google-services.json` required for Android Firebase + AdMob
- Maps use react-native-maps with Google Maps API key in `app.json`

## firebase.json: nada de comillas simples literales

`@react-native-firebase/app` (`ios_config.sh`) mete el contenido de `firebase.json` dentro de un string de Ruby con comillas simples durante el build de iOS. Una `'` literal rompe el build ("Failed to parse firebase.json"). Por eso la Content-Security-Policy de hosting escribe `'self'`, `'none'`, etc. como `'self'`: es el mismo JSON para Firebase CLI. Cualquier valor nuevo con comillas simples tiene que ir escapado igual.

## Eventos de perfiles privados

Los eventos de un organizador con `perfilPublico: false` solo los ven él y sus seguidores aprobados, y `firestore.rules` lo hace cumplir. Cada evento lleva `organizerPrivate` (bool) y `viewers` (organizador + seguidores; `[]` si es público), mantenidos por las Cloud Functions `syncEventPrivacyOnUserUpdate` / `syncEventPrivacyOnEventCreate`. Las reglas solo dejan **listar** eventos con consultas que garanticen el acceso: el feed general filtra `organizerPrivate == false` (`subscribeToEvents`), los privados visibles se piden con `viewers array-contains uid` (`useVisiblePrivateEvents`), los de un perfil con `subscribeToOrganizerEvents`, y Mis planes por `attendees`/`savedBy`. **Una consulta nueva sobre `events` sin uno de esos filtros falla con permission-denied.** Las pruebas están en `tests/rules` (`npm test`; el emulador necesita Java 21+, sirve el de Android Studio: `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`).

## iOS: ciclo de vida UIScene (iOS 27)

iOS 27 cierra al arrancar las apps compiladas con el SDK de Xcode 27 que no usan UIScene. `plugins/withUIScene.js` agrega `UIApplicationSceneManifest` al Info.plist y un `SceneDelegate` (al final de `AppDelegate.swift`) que crea la ventana y arranca React Native; los deep links de la escena se reenvían al AppDelegate. Sacarlo cuando Expo traiga soporte propio de escenas.

## iOS: parches del Podfile (Xcode 27)

`plugins/withPodfileStaticFrameworkFix.js` también sube a 15.1 el deployment target de todos los pods (Xcode 27 rechaza < 15.0) y compila el pod `fmt` en C++17 (fmt 11.0.2 no compila en C++20 con el Clang de Xcode 27). Se reinyecta en cada `expo prebuild`.

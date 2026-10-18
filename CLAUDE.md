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

**Firestore collections**: `users`, `events`, `posts`, `chats`, `messages`, `notifications`

**Key service patterns**:
- All service functions are standalone (not class-based)
- Real-time subscriptions return unsubscribe functions (call in `useEffect` cleanup)
- Image uploads go to Firebase Storage, URL stored in Firestore doc

## App Details

- **Theme**: design system en `src/theme/` — tokens en `tokens.js` (`darkColors`/`lightColors`, `space`, `radius`, `font`, `elev`, `motion`), consumidos vía `useTheme()` de `ThemeProvider`. Dark: `bg.base` `#17131F`, `nav.selected` `#8B6BFF`. **No hardcodear hex ni `fontSize`** — usar los tokens y el componente `src/components/ui/Text.js` (variantes: display/h1/h2/h3/title/subtitle/body/bodyStrong/label/caption/overline/tabLabel). La paleta vieja (`#1a1a2e`, `#6c5ce7`) está deprecada.
- **Language**: Spanish UI (permissions, labels, etc.)
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

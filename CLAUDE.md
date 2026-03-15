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

- **Theme**: Dark (`#1a1a2e` background, `#6c5ce7` accent purple)
- **Language**: Spanish UI (permissions, labels, etc.)
- **Ads**: AdMob `ca-app-pub-5363568499936245~8795174061` — NativeAdCard component
- **Notifications**: In-app (notificationService) + push (pushNotificationService + expo-notifications)
- **Firebase project**: `enfiestados-alpha`
- **EAS project**: `97e444bc-19fc-4a33-bca2-f2eecedd7471`

## Platform Notes

- Android notch/padding handled manually in each screen (Settings, Notifications, CreateEvent, Chat)
- `google-services.json` required for Android Firebase + AdMob
- Maps use react-native-maps with Google Maps API key in `app.json`

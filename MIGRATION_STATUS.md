# MIGRATION_STATUS.md — Enfiestados UX Redesign

> Fase actual: **Fase 1 completada — tokens y tema**
> Fuente de verdad: `UX_DESIGN_SYSTEM.md` v1.1 · Julio 2026

---

## 1. Mapa de pantallas

| Pantalla | Archivo | Componentes que usa | Estado |
|---|---|---|---|
| Home / feed | `screens/HomeScreen.js` | EventCard, InternalAdCard, NativeAdCard, SkeletonLoader | pendiente |
| Explorar (lista + mapa) | `screens/SearchScreen.js` | EventCard, ExternalEventSearchCard, CustomMarker (inline) | pendiente |
| Detalle de evento propio | `screens/EventDetailScreen.js` | CommentsSection, ImageViewerModal, ReportModal, UserAvatar | pendiente |
| Detalle de evento importado | `components/ExternalEventDetailModal.js` | — | pendiente |
| Perfil propio "Mi mochila" | `screens/ProfileScreen.js` | EventCard, PostCard, UserAvatar | pendiente |
| Perfil público | `screens/UserProfileScreen.js` | EventCard, ReportModal, UserAvatar | pendiente |
| Alertas | `screens/NotificationsScreen.js` | — | pendiente |
| Mensajes (lista chats) | `screens/ChatsScreen.js` | UserAvatar | pendiente |
| Chat | `screens/ChatDetailScreen.js` | UserAvatar | pendiente |
| Crear evento | `screens/CreateEventScreen.js` | — | pendiente |
| Editar evento | `screens/EditEventScreen.js` | — | pendiente |
| Configuración | `screens/SettingsScreen.js` | — | pendiente |
| Editar perfil | `screens/EditProfileScreen.js` | UserAvatar | pendiente |
| Login | `screens/LoginScreen.js` | — | pendiente |
| Registro | `screens/RegisterScreen.js` | — | pendiente |
| Recuperar contraseña | `screens/ForgotPasswordScreen.js` | — | pendiente |
| Onboarding gustos | `screens/InterestsScreen.js` | — | pendiente |
| Panel de anuncios | `screens/AdCenterScreen.js` | InternalAdCard | pendiente |
| Crear anuncio | `screens/CreateAdScreen.js` | — | pendiente |
| Solicitud anunciante | `screens/AdvertiserRequestScreen.js` | — | pendiente |
| Panel admin | `screens/AdminScreen.js` | — | pendiente |
| **Mis planes** *(nuevo)* | no existe | — | **pendiente crear** |
| **MessagesScreen** *(nuevo)* | no existe | — | **pendiente crear** |
| **Búsqueda dedicada** *(nuevo)* | no existe | — | **pendiente crear** |

---

## 2. Componentes reutilizables existentes

| Componente | Archivo | Equivalente en Design System | Observaciones |
|---|---|---|---|
| `EventCard` | `components/EventCard.js` | `EventCardHero` + parcial `EventRow` | No implementa los 4 estados; estilos hardcodeados |
| `ExternalEventCard` | `components/ExternalEventCard.js` | `EventRow` | Duplica lógica de EventCard para externos |
| `ExternalEventSearchCard` | `components/ExternalEventSearchCard.js` | `EventRow` | Tercer componente para el mismo objeto evento |
| `PostCard` | `components/PostCard.js` | — | Fuera del scope del rediseño de eventos |
| `CommentsSection` | `components/CommentsSection.js` | — | Reutilizable, limpiar estilos |
| `SkeletonLoader` | `components/SkeletonLoader.js` | `Skeleton` / `SkeletonList` | Solo un tipo de skeleton, necesita variantes |
| `UserAvatar` | `components/UserAvatar.js` | `Avatar` | Falta: iniciales sobre gradiente, tamaños múltiples |
| `InternalAdCard` | `components/InternalAdCard.js` | `SponsoredCard` | Implementación correcta, adaptar tokens |
| `NativeAdCard` | `components/NativeAdCard.js` | — | AdMob externo, mantener |
| `ReportModal` | `components/ReportModal.js` | `Sheet` + `Dialog` | Adaptar a bottom sheet del sistema |
| `LoadingScreen` | `components/LoadingScreen.js` | — | Splash, mantener |
| `ErrorBoundary` | `components/ErrorBoundary.js` | — | Infraestructura, mantener |
| `ImageViewerModal` | `components/ImageViewerModal.js` | — | Mantener |
| `PostDetailModal` | `components/PostDetailModal.js` | — | Fuera del scope |

**Componentes del Design System que NO existen aún:**
`Button`, `Chip`, `StatusBadge`, `Input`, `TextArea`, `SearchField`, `Switch`, `Checkbox`, `Radio`, `Avatar` (completo), `AvatarStack`, `SegmentedControl`, `Tabs`, `EmptyState`, `Snackbar`, `Sheet`, `Dialog`, `StepProgress`, `ProgressBar`, `Slider`, `EventRow`, `EventCardHero`, `MetaRow`, `ActionBar`, `PersonRow`, `Text` (tipado con variantes)

---

## 3. Sistema de navegación actual

- **Stack:** `@react-navigation/native-stack` v7
- **Tabs:** `@react-navigation/bottom-tabs` — 5 destinos: Inicio · Buscar · Crear · Alertas · Perfil
- **Diferencias con Design System:**
  - Tab "Buscar" → debe ser "Explorar"
  - Tab "Crear" (botón `+` central sin etiqueta) → **prohibido** por § 5.1; pasa a flujo modal desde header
  - Tab "Alertas" → correcto
  - Falta tab "Mis planes" *(nuevo)*
  - Mensajes vive en Alertas → debe ser pantalla propia con icono en header de Inicio

---

## 4. Sistema de estilos actual

- **Sin design tokens.** Todos los valores están hardcodeados en `StyleSheet.create` al fondo de cada archivo.
- **Sin theme provider.** No existe soporte de tema claro/oscuro.
- **Sin fuentes personalizadas.** Se usa la fuente del sistema.
- **Paleta actual** (lo que se usará para mapear a tokens):

| Color actual | Ocurrencias | Token destino |
|---|---|---|
| `#fff` | 182 | `color.text.primary` (oscuro) / `color.bg.raised` (claro) |
| `#2d2d44` | 120 | `color.bg.raised` |
| `#6c5ce7` | 119 | `color.nav.selected` (violeta — mapear a `#8B6BFF`) |
| `#888` | 105 | `color.text.tertiary` |
| `#1a1a2e` | 56 | `color.bg.base` (mapear a `#17131F`) |
| `#aaa` | 21 | `color.text.tertiary` |
| `#00b894` | 20 | `color.status.free` (mapear a `#2FBF87`) |
| `#3d3d5c` | 17 | `color.bg.surface` |
| `#e74c3c` | 12 | `color.status.urgent` (mapear a `#E1483F`) |
| `#fdcb6e` | 9 | `color.action.primary` (amarillo — mapear a `#FFC94A`) |

---

## 5. Colores hardcodeados por archivo (top 20)

### Screens
| Archivo | Ocurrencias hex |
|---|---|
| `SearchScreen.js` | 62 |
| `EventDetailScreen.js` | 47 |
| `NotificationsScreen.js` | 45 |
| `CreateEventScreen.js` | 37 |
| `EditEventScreen.js` | 36 |
| `ProfileScreen.js` | 35 |
| `CreateAdScreen.js` | 32 |
| `AdminScreen.js` | 28 |
| `UserProfileScreen.js` | 25 |
| `AdCenterScreen.js` | 25 |
| `RegisterScreen.js` | 20 |
| `AdvertiserRequestScreen.js` | 20 |
| `EditProfileScreen.js` | 18 |
| `LoginScreen.js` | 17 |
| `ChatDetailScreen.js` | 17 |
| `InterestsScreen.js` | 14 |
| `ForgotPasswordScreen.js` | 13 |
| `HomeScreen.js` | 12 |
| `SettingsScreen.js` | 11 |
| `ChatsScreen.js` | 11 |

### Components
| Archivo | Ocurrencias hex |
|---|---|
| `PostDetailModal.js` | 20 |
| `EventCard.js` | 16 |
| `PostCard.js` | 14 |
| `ExternalEventDetailModal.js` | 12 |
| `ExternalEventCard.js` | 11 |
| `CommentsSection.js` | 11 |
| `ReportModal.js` | 10 |
| `InternalAdCard.js` | 10 |
| `ExternalEventSearchCard.js` | 10 |

**Total ocurrencias hex en `src/`:** ~900+

---

## 6. Tamaños de fuente hardcodeados

| fontSize | Ocurrencias | Token destino |
|---|---|---|
| 14 | 57 | `caption` |
| 16 | 47 | `subtitle` |
| 13 | 41 | `caption` / `label` |
| 15 | 29 | `label` |
| 18 | 28 | entre `subtitle` y `h3` |
| 12 | 28 | `overline` |
| 11 | 23 | `tabLabel` |
| 20 | 8 | `h3` |
| 10 | 6 | ⚠️ por debajo del mínimo de 14 px |
| 28 | 5 | `h1` |
| 24 | 5 | `h2` |
| 22 | 4 | entre `h2` y `h3` — no en escala |
| 9 | 3 | ⚠️ muy por debajo del mínimo |
| 36 | 1 | `display` |
| 32 | 1 | entre `display` y `h1` — no en escala |

**Tamaños fuera de la escala del Design System:** 9, 10, 18, 22, 26, 32 px

---

## 7. Problemas críticos detectados (sin tocar código)

1. **3 componentes distintos para el mismo objeto evento** (`EventCard`, `ExternalEventCard`, `ExternalEventSearchCard`) — viola la regla "un solo lugar para el evento" (§ 10 y § 19.2).
2. **Ningún archivo implementa los 4 estados** (cargando, vacío, error, contenido) — viola § 13.
3. **~900 valores hex hardcodeados** sin sistema de tokens — viola regla absoluta #3 del brief.
4. **Botón "+" central sin etiqueta** en barra inferior — patrón prohibido #2 de § 17.
5. **Sin soporte de tema claro** — el Design System define ambos.
6. **Sin fuentes Bricolage Grotesque ni Plus Jakarta Sans** — tipografía actual es la del sistema.
7. **Fechas en formato máquina** (`08/08/2026`) en múltiples pantallas — patrón prohibido #10.
8. **Métricas en cero** presentadas como dato ("0 likes") — patrón prohibido #6.
9. **Tab "Mis planes" no existe** — es el destino que sostiene el modelo de comisión.
10. **Mensajes dentro de Alertas** — debe ser pantalla independiente con acceso desde header.

---

## 8. Pendientes globales de código (no de diseño)

- [ ] Instalar fuentes `Bricolage Grotesque` y `Plus Jakarta Sans` (`expo-font`)
- [ ] Crear `theme/tokens.js` con todos los tokens de § 6
- [ ] Crear `theme/ThemeProvider.js` con soporte claro/oscuro/sistema
- [ ] Crear `i18n/es-CR.json` para todo el copy
- [ ] Migrar los 3 componentes de evento a `EventRow` + `EventCardHero`
- [ ] Implementar los 4 estados en cada pantalla
- [ ] Crear pantalla "Mis planes" (nueva)
- [ ] Crear pantalla "Mensajes" (nueva, separada de Alertas)
- [ ] Crear pantalla "Búsqueda dedicada" (nueva)
- [ ] Reestructurar navegación (quitar "+" central, agregar "Mis planes")

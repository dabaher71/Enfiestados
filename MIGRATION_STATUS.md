# MIGRATION_STATUS.md — Enfiestados UX Redesign

> Reescrito contra el código real (no capturas) el 31 jul 2026, tras FIX_ROUND_4.
> Regla de este archivo: **listo** = migrado a tokens/componentes `ui/` y sin gap conocido de contenido.
> **parcial** = algo concreto falta (se dice qué). **pendiente** = no existe o sigue en diseño viejo.
> Actualizalo en el mismo commit que toca la pantalla — no al final de la sesión.

---

## 1. Mapa de pantallas

| Pantalla | Archivo | Estado | Nota |
|---|---|---|---|
| Inicio / feed | `screens/HomeScreen.js` | listo | FIX_ROUND_5: card grande (`EventCardLarge` variant="large") con carrusel, mitigaciones de densidad § 3 (chips y header se compactan al scrollear) |
| Explorar (lista + mapa) | `screens/SearchScreen.js` | listo | FIX_ROUND_5 § 4: lista usa `EventCardLarge` variant="compact". Mapa con estilo claro/oscuro por tokens (§ 8) |
| Detalle de evento propio | `screens/EventDetailScreen.js` | listo | FIX_ROUND_5: hero con `MediaCarousel`. Guardar, snackbar, navegación a Mis Planes corregida |
| Detalle de evento importado | `screens/ExternalEventDetailScreen.js` | listo | Bug de layout (botones tapados) y guardado de importados arreglados |
| Mis planes | `screens/MyPlansScreen.js` | listo | Ticket con contraste AA (§ 7), guarda nativos + importados |
| Perfil propio "Mi mochila" | `screens/ProfileScreen.js` | listo | § 4.4 "Tu próximo plan" implementado |
| Perfil público | `screens/UserProfileScreen.js` | parcial | Tokens ok; no re-auditado a fondo esta ronda |
| Editar perfil | `screens/EditProfileScreen.js` | listo | |
| Alertas | `screens/NotificationsScreen.js` | listo | Verificado con datos reales: 4 tipos, agrupado por día, corte a fecha absoluta a los 7 días, nombre/título largos, leído/no leído |
| Config. de alertas | `screens/NotificationsSettingsScreen.js` | listo | |
| Mensajes (lista chats) | `screens/MessagesScreen.js` | listo | Bug real corregido: no resolvía nombre/avatar del otro participante (esos campos no existen en el doc de chat), toda fila mostraba "Usuario" y avatar vacío. `ChatsScreen.js` (duplicado sin uso, nada navegaba a él) borrado. |
| Chat | `screens/ChatDetailScreen.js` | listo | Verificado con datos reales: burbujas agrupadas, separador por día, tarjeta de evento compartido, no leído |
| Crear evento | `screens/CreateEventScreen.js` | listo | Wizard 3 pasos. FIX_ROUND_5 § 5: paso 1 sube varias imágenes (`ImageGridPicker`, hasta 10, reordenables) |
| Editar evento | `screens/EditEventScreen.js` | listo | FIX_ROUND_5 § 5: mismo `ImageGridPicker` que crear evento |
| Crear publicación | `screens/CreatePostScreen.js` | parcial | Tokens ok; sigue con una sola imagen (no se tocó esta ronda). No re-auditada a fondo |
| Configuración | `screens/SettingsScreen.js` | listo | Cápsula `rgba(255,255,255,.07)` corregida (§ 10.1) |
| Login | `screens/LoginScreen.js` | listo | Ya no es un muro: al abrir la app sin sesión se entra directo como invitado (Firebase Auth anónimo) al feed real, sin pasar por esta pantalla |
| Registro | `screens/RegisterScreen.js` | listo | |
| Recuperar contraseña | `screens/ForgotPasswordScreen.js` | listo | |
| Onboarding gustos | `screens/InterestsScreen.js` | listo | Paso de intereses (3 pasos, "Omitir" visible desde el paso 1, alimenta el ranking real del feed — ver § 4) |
| Panel admin | `screens/AdminScreen.js` | listo | Migrado completo — FIX_ROUND_4 § 1 |
| Panel de anuncios | `screens/AdCenterScreen.js` | listo | |
| Crear anuncio | `screens/CreateAdScreen.js` | listo | `themeVariant` y `fontSize` corregidos |
| Solicitud anunciante | `screens/AdvertiserRequestScreen.js` | listo | |
| Panel de organizador | `screens/OrganizerPanelScreen.js` | listo | |
| Búsqueda dedicada (recientes/sugerencias) | no existe | pendiente | Hoy vive dentro de Explorar; una pantalla propia sigue sin construir |
| Bienvenida / onboarding (`8a`–`8d`) | — | listo | `8a` sin muro (boot anónimo + `requireAccount`), `8b`–`8d` = `InterestsScreen` (ya existía, salteable, alimenta el ranking real del feed) — ver § 4 |

`DevCatalogScreen.js` es herramienta interna de desarrollo (`__DEV__` only) — fuera de este inventario.

---

## 2. Componentes reutilizables — `src/components/ui/`

Los componentes del design system existen y están en uso real: `Avatar`, `Button`, `Chip`, `EmptyState`, `EventRow`, `Input` (+ `TextArea`, `SearchField`), `MetaRow`, `SegmentedControl` (+ `UnderlineTabs`), `Sheet`, `Skeleton` (+ `SkeletonEventRow`, `SkeletonList`), `Snackbar`, `StatusBadge`, `Text`.

**FIX_ROUND_5** — tres componentes nuevos: `MediaCarousel` (carrusel de imágenes, compartido por `EventCardLarge`, `EventDetailScreen` y `PostDetailModal`), `EventCardLarge` (card grande de Inicio/Explorar, variants `large`/`compact` — reemplaza a `EventRow` SOLO ahí, `EventRow` sigue viva en Mis planes/Perfil/Búsqueda), `ImageGridPicker` (subida múltiple con reorden, compartido por Crear y Editar evento).

No hay componentes del design system pendientes de crear.

**Código muerto — borrado.** `EventCard.js`, `ExternalEventCard.js`, `ExternalEventSearchCard.js`,
`ExternalEventDetailModal.js`, `SkeletonLoader.js`, `UserAvatar.js` tenían cero imports activos
(verificado con grep en todo `src/`, no solo por nombre de archivo) — reemplazados hace tiempo por
`EventRow`/`ExternalEventDetailScreen`/`ui/Skeleton`/`ui/Avatar`. Borrados, no migrados.

`navigation/TabNavigator.js` — duplicado viejo de `MainTabNavigator.js` (paleta hex hardcodeada,
tabs distintos, sin `MyPlans`/`CreatePost`/`Messages`). Nada lo importaba (`AppNavigator.js` usa
`MainTabNavigator`, no `TabNavigator`) — cero referencias en todo el repo. Borrado.

**Deuda real restante en `src/components`:**
- `components/InternalAdCard.js` — activo (se renderiza en Home), estaba 100% en paleta vieja. Migrado en FIX_ROUND_4 § 10.1.
- `components/CommentsSection.js` — parcialmente auditado (nombre/hora de comentario ya usan tokens; `formatDate` local ya no se queda pegado en "Nd" para siempre — cae a fecha absoluta a los 7 días). Todavía tiene hex suelto sin revisar (trash icon, empty state, fondos de reply).
- `components/PostCard.js`, `PostDetailModal.js` — solo se les agregó `hitSlop` en sus botones <44px; el resto del archivo no se auditó por hex hardcodeado.

---

## 3. Verificación pendiente — deuda no confirmada esta ronda

Estos archivos activos no se auditaron a fondo por hex hardcodeado en FIX_ROUND_4 (el sweep cubrió `src/screens` completo; en `src/components` solo los patrones específicos reportados + el código muerto, ya borrado):

- `components/CommentsSection.js`, `PostCard.js`, `PostDetailModal.js`, `ReportModal.js`, `ImageViewerModal.js`

Antes de dar estos por migrados: `grep -rn "#[0-9A-Fa-f]\{6\}" src/components/<archivo>`.

---

## 4. Pendientes globales

- [ ] Pantalla "Búsqueda dedicada" (recientes/sugerencias) — no existe
- [x] Flujo de bienvenida/onboarding (`8a`–`8d`) — sin muro de login + gustos salteables que sí filtran el feed
- [x] Confirmar contenido real de Alertas (mockup `10a`) — verificado con datos reales
- [x] Confirmar contenido real de Mensajes/Chat (mockups `10b`/`10c`) — verificado con datos reales, bug de nombre/avatar corregido
- [ ] Auditar hex hardcodeado en `CommentsSection.js`, `PostCard.js`, `PostDetailModal.js`, `ReportModal.js`, `ImageViewerModal.js`
- [ ] FIX_ROUND_5: card grande + carrusel construidos y verificados por código (lectura del componente, no por correr la app — no hubo simulador/dispositivo esta sesión). Pendiente confirmar en dispositivo real: el swipe horizontal del carrusel no le gana el scroll vertical al feed, el drag-to-reorder de `ImageGridPicker` no choca con el `ScrollView` que lo contiene, y los dos temas (claro/oscuro) se ven bien

## 5. Sin muro de login (`8a`) — cómo funciona

`AppNavigator.js`: al abrir la app sin sesión, en vez de mostrar `LoginScreen` se llama
`signInAnonymously()` y se entra directo al feed real como invitado (si falla, ej. sin red, ahí sí
se cae a `LoginScreen`). `LoginScreen`/`RegisterScreen`/`ForgotPasswordScreen` quedan registradas
también dentro del árbol autenticado — son el destino de "Crear cuenta" del gate, no la puerta de
entrada por defecto.

`src/lib/requireAccount.js`: gate reutilizable — `if (!requireAccount(navigation, mensaje)) return;`
antes de cualquier acción que escribe datos. Cablead o en: guardar evento (nativo + importado),
asistir, like de evento/publicación, comentar (evento y publicación), seguir, enviar mensaje, crear
evento. "Comprar" (`ExternalEventDetailScreen`) no lleva gate — abre un link externo, no escribe en
Firestore. `ProfileScreen` (tab Perfil) muestra un CTA "Creá tu cuenta" en vez de un perfil vacío/roto
cuando `currentUser.isAnonymous` — antes de esto no había ningún doc en `users/` para un invitado y
la pantalla mostraba `@undefined`.

Nota: las reglas de Firestore (`firestore.rules`) siguen permitiendo `likes`/`attendees`/`savedBy`/
`comments` a cualquier `isAuth()`, anónimo incluido — el gate de arriba es a nivel de UI/producto, no
de seguridad. Un cliente que llame a Firestore directo (no la app) podría saltárselo. Pendiente si se
quiere cerrar del todo: reemplazar `isAuth()` por un helper `isReal()` (excluye
`sign_in_provider == 'anonymous'`) en esas rutas de `events`/`posts`.

**Crear cuenta desde invitado — `linkWithCredential`.** `RegisterScreen.js` y
`services/googleAuthService.js` usan `linkWithCredential` (no `createUserWithEmailAndPassword`/
`signInWithCredential` directo) cuando `auth.currentUser?.isAnonymous` — conserva el uid, así que lo
que el invitado ya guardó/confirmó (`savedBy`/`attendees` escritos con ese uid) sigue siendo suyo
después de crear la cuenta. Si el correo/cuenta de Google ya pertenece a otra cuenta real
(`auth/credential-already-in-use` / `auth/email-already-in-use`), se cae a iniciar sesión con esa
cuenta y se avisa ("Ya tenés una cuenta... Entramos con esa") — los datos de la sesión de invitado se
descartan ahí, pero a propósito y avisado, no en silencio.

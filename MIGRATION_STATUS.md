# MIGRATION_STATUS.md — Enfiestados UX Redesign

> Reescrito contra el código real (no capturas) el 31 jul 2026, tras FIX_ROUND_4.
> Regla de este archivo: **listo** = migrado a tokens/componentes `ui/` y sin gap conocido de contenido.
> **parcial** = algo concreto falta (se dice qué). **pendiente** = no existe o sigue en diseño viejo.
> Actualizalo en el mismo commit que toca la pantalla — no al final de la sesión.

---

## 1. Mapa de pantallas

| Pantalla | Archivo | Estado | Nota |
|---|---|---|---|
| Inicio / feed | `screens/HomeScreen.js` | listo | Chips migrados a `Chip` (FIX_ROUND_4 § 2) |
| Explorar (lista + mapa) | `screens/SearchScreen.js` | listo | Mapa con estilo claro/oscuro por tokens (§ 8) |
| Detalle de evento propio | `screens/EventDetailScreen.js` | listo | Guardar, snackbar, navegación a Mis Planes corregida |
| Detalle de evento importado | `screens/ExternalEventDetailScreen.js` | listo | Bug de layout (botones tapados) y guardado de importados arreglados |
| Mis planes | `screens/MyPlansScreen.js` | listo | Ticket con contraste AA (§ 7), guarda nativos + importados |
| Perfil propio "Mi mochila" | `screens/ProfileScreen.js` | listo | § 4.4 "Tu próximo plan" implementado |
| Perfil público | `screens/UserProfileScreen.js` | parcial | Tokens ok; no re-auditado a fondo esta ronda |
| Editar perfil | `screens/EditProfileScreen.js` | listo | |
| Alertas | `screens/NotificationsScreen.js` | parcial | Tokens ok; contenido real (mockup `10a`) sin confirmar esta ronda |
| Config. de alertas | `screens/NotificationsSettingsScreen.js` | listo | |
| Mensajes (lista chats) | `screens/ChatsScreen.js` | parcial | Tokens ok; contenido real (mockup `10b`) sin confirmar esta ronda |
| Mensajes (nueva, separada) | `screens/MessagesScreen.js` | parcial | Existe; contenido real sin confirmar esta ronda |
| Chat | `screens/ChatDetailScreen.js` | parcial | Tokens ok; contenido real (mockup `10c`) sin confirmar esta ronda |
| Crear evento | `screens/CreateEventScreen.js` | listo | Wizard 3 pasos, `themeVariant` corregido |
| Editar evento | `screens/EditEventScreen.js` | listo | Migrado completo ronda 3 sesión final |
| Crear publicación | `screens/CreatePostScreen.js` | parcial | Tokens ok; no re-auditada a fondo esta ronda |
| Configuración | `screens/SettingsScreen.js` | listo | Cápsula `rgba(255,255,255,.07)` corregida (§ 10.1) |
| Login | `screens/LoginScreen.js` | listo | |
| Registro | `screens/RegisterScreen.js` | listo | |
| Recuperar contraseña | `screens/ForgotPasswordScreen.js` | listo | |
| Onboarding gustos | `screens/InterestsScreen.js` | listo | Es el paso de intereses, no la bienvenida completa (ver § 4) |
| Panel admin | `screens/AdminScreen.js` | listo | Migrado completo — FIX_ROUND_4 § 1 |
| Panel de anuncios | `screens/AdCenterScreen.js` | listo | |
| Crear anuncio | `screens/CreateAdScreen.js` | listo | `themeVariant` y `fontSize` corregidos |
| Solicitud anunciante | `screens/AdvertiserRequestScreen.js` | listo | |
| Panel de organizador | `screens/OrganizerPanelScreen.js` | listo | |
| Búsqueda dedicada (recientes/sugerencias) | no existe | pendiente | Hoy vive dentro de Explorar; una pantalla propia sigue sin construir |
| Bienvenida / onboarding (`8a`–`8d`) | no existe | pendiente | Solo existe el paso de intereses (`InterestsScreen`) |

`DevCatalogScreen.js` es herramienta interna de desarrollo (`__DEV__` only) — fuera de este inventario.

---

## 2. Componentes reutilizables — `src/components/ui/`

Los 19+ componentes del design system existen y están en uso real: `Avatar`, `Button`, `Chip`, `EmptyState`, `EventRow`, `Input` (+ `TextArea`, `SearchField`), `MetaRow`, `SegmentedControl` (+ `UnderlineTabs`), `Sheet`, `Skeleton` (+ `SkeletonEventRow`, `SkeletonList`), `Snackbar`, `StatusBadge`, `Text`.

No hay componentes del design system pendientes de crear.

**Código muerto — borrado.** `EventCard.js`, `ExternalEventCard.js`, `ExternalEventSearchCard.js`,
`ExternalEventDetailModal.js`, `SkeletonLoader.js`, `UserAvatar.js` tenían cero imports activos
(verificado con grep en todo `src/`, no solo por nombre de archivo) — reemplazados hace tiempo por
`EventRow`/`ExternalEventDetailScreen`/`ui/Skeleton`/`ui/Avatar`. Borrados, no migrados.

**Deuda real restante en `src/components`:**
- `components/InternalAdCard.js` — activo (se renderiza en Home), estaba 100% en paleta vieja. Migrado en FIX_ROUND_4 § 10.1.
- `components/CommentsSection.js` — parcialmente auditado (nombre/hora de comentario ya usan tokens); todavía tiene hex suelto sin revisar (trash icon, empty state, fondos de reply).
- `components/PostCard.js`, `PostDetailModal.js` — solo se les agregó `hitSlop` en sus botones <44px; el resto del archivo no se auditó por hex hardcodeado.

---

## 3. Verificación pendiente — deuda no confirmada esta ronda

Estos archivos activos no se auditaron a fondo por hex hardcodeado en FIX_ROUND_4 (el sweep cubrió `src/screens` completo; en `src/components` solo los patrones específicos reportados + el código muerto, ya borrado):

- `components/CommentsSection.js`, `PostCard.js`, `PostDetailModal.js`, `ReportModal.js`, `ImageViewerModal.js`

Antes de dar estos por migrados: `grep -rn "#[0-9A-Fa-f]\{6\}" src/components/<archivo>`.

---

## 4. Pendientes globales

- [ ] Pantalla "Búsqueda dedicada" (recientes/sugerencias) — no existe
- [ ] Flujo de bienvenida/onboarding (`8a`–`8d`) — no existe, solo el paso de intereses
- [ ] Confirmar contenido real de Alertas/Mensajes/Chat (mockups `10a`/`10b`/`10c`) — **Alertas es la próxima sesión**
- [ ] Auditar hex hardcodeado en `CommentsSection.js`, `PostCard.js`, `PostDetailModal.js`, `ReportModal.js`, `ImageViewerModal.js`

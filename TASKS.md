# Enfiestados — Tareas y Contexto del Proyecto

## Versión actual: v0.6 (en main)

---

## Historial de versiones completadas

### v0.1 — Initial commit
- Proyecto base con Expo + Firebase

### v0.2
- Fix bugs iniciales
- Marcadores Android en mapa
- Exportar APK (EAS)
- Push notifications
- Fix teclado en comentarios

### v0.3
- Integración AdMob (NativeAdCard)
- Filtros de búsqueda (tiempo / provincia)
- Skeleton loading
- Eliminar comentarios
- Pull to refresh
- Fix fechas en chat
- Mejoras UI generales

### v0.4
- Posts: crear publicaciones con fotos
- Likes y comentarios en posts
- Tabs en perfil (Eventos / Posts)
- PostCard con estilo dark
- CreatePostScreen, postService

### v0.4.1
- Padding notch Android en: Settings, Notifications, CreateEvent, Chat
- Quitar botón "Siguiendo" duplicado
- Quitar logout duplicado

### v0.5
- Eventos externos (fuente externa integrada)
- Ads mejorados
- Sorting de eventos
- Mejoras UX / seguridad
- Fix imágenes
- Fix notch

---

## En progreso (sin commitear — rama main)

### Auth v0.6 ✅
- [x] `ForgotPasswordScreen.js` — recuperación de contraseña via Firebase email
- [x] `googleAuthService.js` — Google Sign-In con `@react-native-google-signin/google-signin`
- [x] `LoginScreen` — botón Google funcional + navegación a ForgotPassword
- [x] `RegisterScreen` — botón Google + envío de email de verificación al registrarse
- [x] `AppNavigator` — ruta ForgotPassword agregada + fix splash (eliminado delay hardcodeado de 5s)
- [x] `chatService` — ID de chat determinista (evita duplicados por race condition), límite de 1000 chars por mensaje
- [x] `eventService` — transacciones atómicas en likes y asistencia (evita race conditions)
- [x] `postService` — mejoras
- [x] `CommentsSection` — mejoras
- [x] `firestore.rules` — reglas actualizadas
- [x] Commit v0.6 realizado y pusheado a GitHub

### Algoritmo de feed personalizado v0.7 (en progreso)
- [x] `signalService.js` — tracking de señales por usuario (view, longView, open, like, attend, comment, hide) → escribe a `userSignals/{userId}/interactions/{eventId}` y actualiza `interestVector` en `users/{userId}`
- [x] `feedService.js` — scoring client-side: afinidad de categoría (40%), popularidad log-scale (25%), recencia (25%), score social reservado (10%)
- [x] `EventCard.js` — long press "No me interesa" → señal negativa + ocultar card del feed
- [x] `HomeScreen.js` — tab "Para ti" usa `scoreAndRankEvents()`, `onViewableItemsChanged` mide tiempo de vista (>3s = longView), `getItemType` para reciclado eficiente en FlashList
- [x] `EventDetailScreen.js` — señales: `open` al entrar, `like`/`unlike` y `attend`/`unattend` al tocar
- [x] `CommentsSection.js` — señal `comment` al publicar
- [x] `eventService.js` — `fetchEventsByIds()` para feeds pre-computados (preparado para v2)
- [x] Actualizar reglas de Firestore para colección `userSignals` (permitir write solo al propio usuario)
- [x] Cloud Function de scoring pre-computado — `computePersonalizedFeeds` corre cada 30 min para usuarios activos, escribe `feeds/{userId}`; `refreshMyFeed` callable desde pull-to-refresh ✅ deployada
- [x] `lastActive` en `users/{userId}` — se actualiza con `serverTimestamp()` en cada login/apertura de app (requerido por `computePersonalizedFeeds` para filtrar usuarios activos)
- [x] Señal social: amigos que asisten al mismo evento — implementada en Cloud Function usando `following` del usuario

---

## Pendientes / Roadmap

### Funcionalidades por implementar
- [ ] Agrandar cards — EventCard y ExternalEventCard (imagen más alta, texto más grande)
- [ ] Sistema de tickets / RSVP formal
- [ ] Mapa con clustering de eventos cercanos
- [ ] Búsqueda por texto libre (nombre de evento)
- [ ] Deep linking (abrir evento desde notificación push)
- [ ] Rate limiting en comentarios / posts (anti-spam)
- [ ] Like en comentarios individuales (no existe UI aún)

### Sistema de reportes — Roadmap
**Fase 1 — Estructura de datos** ✅
- [x] Colección `reports` en Firestore: campos `reporterId`, `targetType` (user/event/post), `targetId`, `reason`, `status` (pending/reviewed/dismissed/actioned), `createdAt`
- [x] Reglas de Firestore: cualquier usuario verificado puede crear un reporte, solo admin puede leerlos/actualizarlos
- [x] Razones predefinidas: spam, acoso, contenido inapropiado, cuenta falsa, violencia, otro — en `src/services/reportService.js`

**Fase 2 — UI en la app** ✅
- [x] Botón "Reportar" en menú de 3 puntos de EventDetailScreen (para no-organizadores)
- [x] Botón "Reportar" (flag icon) en PostCard (para no-autores)
- [x] Botón "Reportar" (flag icon) en UserProfileScreen (junto al botón de bloquear)
- [x] `ReportModal.js` — bottom sheet con selección de razón
- [x] Confirmación y feedback al usuario ("Reporte enviado")
- [x] Prevenir reportes duplicados (query antes de insertar en `createReport`)

**Fase 3 — Panel de administración**
- [ ] Pantalla admin en la app (requiere campo `isAdmin: true` en el doc del usuario admin)
- [x] `processReportAction` Cloud Function — acciones: dismiss, warn, delete_content, ban ✅ deployada
- [x] Notificación al usuario reportado cuando se toma acción (warn envía notificación tipo `admin_warning`)
- [x] Ban deshabilita la cuenta en Firebase Auth + marca `banned: true` en Firestore

**Fase 4 — Automatización**
- [x] `onReportCreated` Cloud Function — auto-oculta contenido al llegar a 5 reportes (pendiente retry deploy por permisos Eventarc)
- [ ] Sistema de apelaciones para usuarios baneados
- [ ] Dashboard de estadísticas de moderación

### Mejoras técnicas
- [x] `createEvent` usa `serverTimestamp()` para nuevos eventos
- [x] `scripts/migrateCreatedAt.js` — script one-time para migrar docs existentes (requiere serviceAccount.json)
- [x] Paginación en feed de eventos (20 por página, carga más al llegar al final)
- [ ] Offline support con caché de Firestore (requiere migrar a @react-native-firebase/firestore para soporte nativo completo)
- [x] Manejo de errores global — `src/utils/errorHandler.js` con `getFriendlyError` + override de `console.error` en producción (App.js)

### Seguridad — pendientes (requieren acción externa o infraestructura)
- [ ] **Rotar Google Maps API Key** en Google Cloud Console y restringirla al bundle ID de la app
- [ ] **Implementar Firebase App Check** para rate limiting real en servidor (evita spam de eventos, comentarios, mensajes desde clientes modificados)
- [ ] **expo-secure-store** en lugar de AsyncStorage para tokens de autenticación (evita extracción en dispositivos rooteados) — requiere instalación de paquete y refactor de `src/config/firebase.js`
- [ ] **Cloud Functions** para validaciones críticas de servidor (organizerId, precios negativos, campos requeridos)
- [x] Sanitizar `console.error` — override global en App.js (solo producción), sanitiza objetos Firebase antes de loguear
- [x] `serverTimestamp()` en `eventService.createEvent` — implementado; ejecutar `scripts/migrateCreatedAt.js` para docs existentes

### Producción / Distribución
- [ ] Build de producción Android firmado
- [ ] Subir a Google Play (track interno o beta)
- [ ] Preparar build iOS + cuenta Apple Developer
- [ ] Configurar OTA updates automáticos con `eas update`

---

## Notas técnicas importantes

- **SHA-1 para Google Sign-In Android**: debe registrarse en Firebase Console → Configuración del proyecto → Huella digital de la app
- **EAS project ID**: `97e444bc-19fc-4a33-bca2-f2eecedd7471`
- **Firebase project**: `enfiestados-alpha`
- **AdMob app ID**: `ca-app-pub-5363568499936245~8795174061`
- **Google OAuth web client ID**: `211216248478-vnd4avn6mf7pn9tqhhbm6ercfmkqb4b0.apps.googleusercontent.com`

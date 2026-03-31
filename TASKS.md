# Enfiestados — Tareas y Contexto del Proyecto

## Versión actual: v0.5 (en main)

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

### Auth v0.6
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
- [ ] **Pendiente: hacer commit de todo esto como v0.6**

### Acciones externas pendientes (no se hacen desde el código)
- [x] **`firebase deploy --only firestore:rules`** — activar reglas de la colección `reports` (y todos los cambios acumulados desde v0.5)
- [x] Confirmar que Google Sign-In funciona en build Android (SHA-1 registrado en Firebase Console y `google-services.json` actualizado)
- [x] Rotar Google Maps API Key en Google Cloud Console y restringirla al bundle ID de la app

### Verificaciones antes del commit v0.6
- [ ] Confirmar que Google Sign-In funciona en build Android (requiere SHA-1 registrado en Firebase Console y `google-services.json` actualizado)
- [ ] Verificar Google Sign-In en iOS (requiere config en `app.json` si aplica)
- [ ] Probar flujo completo de ForgotPassword

---

## Pendientes / Roadmap

### Funcionalidades por implementar
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
- [ ] Web app o pantalla admin para revisar reportes pendientes
- [ ] Acciones: desestimar, advertir al usuario, eliminar contenido, banear cuenta
- [ ] Notificación al usuario reportado cuando se toma acción
- [ ] Firebase Cloud Function para procesar acciones (eliminar docs, deshabilitar auth)

**Fase 4 — Automatización**
- [ ] Auto-ocultar contenido con más de N reportes mientras se revisa
- [ ] Sistema de apelaciones para usuarios baneados
- [ ] Dashboard de estadísticas de moderación

### Mejoras técnicas
- [ ] Migrar `createdAt` de eventos a `serverTimestamp()` — requiere migración de datos existentes en Firestore (cambio de tipo string → Timestamp)
- [x] Paginación en feed de eventos (20 por página, carga más al llegar al final)
- [ ] Offline support con caché de Firestore
- [ ] Manejo de errores global (actualmente cada pantalla maneja sus propios errores)

### Seguridad — pendientes (requieren acción externa o infraestructura)
- [ ] **Rotar Google Maps API Key** en Google Cloud Console y restringirla al bundle ID de la app
- [ ] **Implementar Firebase App Check** para rate limiting real en servidor (evita spam de eventos, comentarios, mensajes desde clientes modificados)
- [ ] **expo-secure-store** en lugar de AsyncStorage para tokens de autenticación (evita extracción en dispositivos rooteados) — requiere instalación de paquete y refactor de `src/config/firebase.js`
- [ ] **Cloud Functions** para validaciones críticas de servidor (organizerId, precios negativos, campos requeridos)
- [ ] Sanitizar `console.error` en todas las pantallas usando `sanitizeError` de `src/utils/security.js` (actualmente loguea objetos Firebase completos)
- [ ] `serverTimestamp()` en `eventService.createEvent` — requiere migración de datos en Firestore

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

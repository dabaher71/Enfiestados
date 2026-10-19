# Pendiente: actualizar Términos y Política de Privacidad por contenido multimedia

Creado el 2026-10-18. **Bloqueante para publicar en tiendas**, no para seguir desarrollando.

## Qué cambió en el producto

1. **Publicaciones con hasta 3 archivos** (antes: una sola imagen). El modelo
   ya contempla video, aunque todavía está apagado — ver `VIDEO_ENABLED` en
   `src/services/postService.js`.
2. **Fotos en la mensajería.** Hasta ahora los chats eran solo texto. Ahora el
   dueño de un grupo puede enviar fotos, y en los chats directos puede
   cualquiera de los dos.

Esto cambia las reglas: la mensajería dejó de ser solo texto, y eso toca
retención, moderación y tratamiento de datos personales.

## Qué hay que revisar con el abogado

### Términos y Condiciones
- **Licencia de contenido**: qué derechos otorga la persona al subir fotos y
  videos, y qué puede hacer Enfiestados con ese material.
- **Contenido prohibido** en imágenes y video, no solo en texto. Hoy los T&C
  describen contenido textual.
- **Moderación de imágenes**: hoy existe reporte de publicaciones, pero **no
  hay moderación de las fotos enviadas por chat**. Hay que decidir si se
  modera y declararlo. Esto importa especialmente porque una foto en un grupo
  llega a hasta 100 personas.
- **Responsabilidad sobre material de terceros** subido por usuarios
  (derechos de autor, imagen de personas).

### Política de Privacidad
- **Qué se almacena y dónde**: Firebase Storage, bucket
  `enfiestados-alpha.firebasestorage.app`, rutas `posts/{uid}/` y
  `chats/{uid}/`.
- **Cuánto tiempo se conserva** una foto enviada por chat, y qué pasa al
  borrar el mensaje, al salir del grupo o al eliminar la cuenta.
  **Hoy no se borra nada de Storage** cuando se elimina una cuenta — ver más
  abajo.
- **Metadatos EXIF**: las fotos pueden traer geolocalización. Hoy **no se
  limpian** antes de subirlas. Es un dato personal viajando sin declarar.
  Decidir entre limpiarlos al subir (preferible) o declararlo.
- **Ley 8968** (Protección de la Persona frente al tratamiento de sus datos
  personales): una foto de una persona identificable es un dato personal.

### Fichas de tienda
- **Google Play — Data Safety**: hay que declarar "Fotos y videos" como dato
  recolectado, con su finalidad.
- **Apple — App Privacy**: lo mismo en las nutrition labels.
- **Clasificación de contenido**: permitir que los usuarios suban imágenes y
  se las manden entre sí suele subir la calificación por edad y activa
  preguntas sobre moderación y sobre si hay interacción entre usuarios.

## Deuda técnica relacionada

- **Borrado en Storage**: `confirmAccountDeletion` elimina los documentos de
  Firestore pero **no los archivos de Storage**. Con fotos de chat de por
  medio, esto pasa de ser un descuido a un incumplimiento de lo que la
  política vaya a prometer.
- **Sin moderación de imágenes de chat**: no hay reporte ni revisión sobre las
  fotos enviadas en conversaciones.
- **Sin limpieza de EXIF** al subir.
- **Video apagado**: encenderlo requiere `expo-video`, que es módulo nativo y
  obliga a `prebuild` + `pod install` + build nuevo. Además hay que ampliar
  `storage.rules` (hoy solo acepta `image/*`) y definir límites de tamaño y
  duración.

import * as ImageManipulator from 'expo-image-manipulator';

// Prepara una foto de la galería o la cámara para subirla: la redimensiona al
// lado largo de 1440px y la recodifica como JPEG al 85%.
//
// Por qué antes de cualquier validación de tamaño: una foto de un teléfono
// actual (12–48 MP, a veces HEIC convertido a JPEG) pesa 5–15 MB tal como sale
// del selector, y el tope de 5 MB de storage.rules la rechazaba aunque, ya
// comprimida, pese 300–800 KB. El tope de 5 MB sigue en el servidor como freno
// contra abusos; acá se garantiza que una foto normal nunca llegue a tocarlo.
//
// De paso, recodificar descarta los metadatos EXIF (incluida la ubicación GPS),
// que antes viajaban tal cual a Storage (ver PENDIENTE-legal-multimedia.md).
export const MAX_LONG_SIDE = 1440;
const JPEG_QUALITY = 0.85;

// asset: { uri, width?, height? } — el formato de expo-image-picker.
// Devuelve { uri, width, height } del JPEG ya comprimido.
export async function compressForUpload(asset) {
  const { uri, width, height } = asset;
  const longSide = Math.max(width || 0, height || 0);
  const actions = longSide > MAX_LONG_SIDE
    ? [{ resize: width >= height ? { width: MAX_LONG_SIDE } : { height: MAX_LONG_SIDE } }]
    : [];
  return ImageManipulator.manipulateAsync(uri, actions, {
    compress: JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });
}

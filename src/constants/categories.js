// Fuente única de verdad para todas las categorías de la app.
// Usado en: CreateEvent, EditEvent, Search, CreateAd, InterestsScreen, feedService, adService.
//
// El nombre visible sale del idioma de la app (src/i18n, "categories.<id>").
// Es un getter para que c.name siga funcionando en todos lados sin cambios.
import i18n from '../i18n';

const withName = (c) => Object.defineProperty(c, 'name', {
  get: () => i18n.t(`categories.${c.id}`),
  enumerable: true,
});

export const CATEGORIES = [
  { id: 'musica',     icon: 'musical-notes',        color: '#e74c3c', emoji: '🎵' },
  { id: 'fiesta',     icon: 'beer',                 color: '#6c5ce7', emoji: '🎉' },
  { id: 'deporte',    icon: 'football',             color: '#00b894', emoji: '⚽' },
  { id: 'arte',       icon: 'color-palette',        color: '#fdcb6e', emoji: '🎨' },
  { id: 'comida',     icon: 'restaurant',           color: '#e17055', emoji: '🍽️' },
  { id: 'tech',       icon: 'laptop',               color: '#0984e3', emoji: '💻' },
  { id: 'networking', icon: 'people',               color: '#00cec9', emoji: '🤝' },
  { id: 'educacion',  icon: 'school',               color: '#a29bfe', emoji: '📚' },
  { id: 'cine',       icon: 'film',                 color: '#fd79a8', emoji: '🎬' },
  { id: 'bienestar',  icon: 'fitness',              color: '#55efc4', emoji: '🧘' },
  { id: 'naturaleza', icon: 'leaf',                 color: '#27ae60', emoji: '🌿' },
  { id: 'familia',    icon: 'heart',                color: '#f9ca24', emoji: '👨‍👩‍👧' },
].map(withName);

// Mapa id → objeto categoría para lookups O(1)
export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

// Mapa id → color (compatible con el CATEGORY_COLORS que usaba SearchScreen)
export const CATEGORY_COLORS = Object.fromEntries(CATEGORIES.map(c => [c.id, c.color]));

export const getCategoryById = (id) => CATEGORY_MAP[id] ?? null;
export const getCategoryColor = (id) => CATEGORY_COLORS[id] ?? '#6c5ce7';
export const getCategoryName  = (id) => CATEGORY_MAP[id]?.name ?? id;

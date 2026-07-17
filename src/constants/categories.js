// Fuente única de verdad para todas las categorías de la app.
// Usado en: CreateEvent, EditEvent, Search, CreateAd, InterestsScreen, feedService, adService.

export const CATEGORIES = [
  { id: 'musica',     name: 'Música',        icon: 'musical-notes',        color: '#e74c3c', emoji: '🎵' },
  { id: 'fiesta',     name: 'Fiesta',         icon: 'beer',                 color: '#6c5ce7', emoji: '🎉' },
  { id: 'deporte',    name: 'Deportes',       icon: 'football',             color: '#00b894', emoji: '⚽' },
  { id: 'arte',       name: 'Arte & Cultura', icon: 'color-palette',        color: '#fdcb6e', emoji: '🎨' },
  { id: 'comida',     name: 'Gastronomía',    icon: 'restaurant',           color: '#e17055', emoji: '🍽️' },
  { id: 'tech',       name: 'Tecnología',     icon: 'laptop',               color: '#0984e3', emoji: '💻' },
  { id: 'networking', name: 'Networking',     icon: 'people',               color: '#00cec9', emoji: '🤝' },
  { id: 'educacion',  name: 'Educación',      icon: 'school',               color: '#a29bfe', emoji: '📚' },
  { id: 'cine',       name: 'Cine',           icon: 'film',                 color: '#fd79a8', emoji: '🎬' },
  { id: 'bienestar',  name: 'Bienestar',      icon: 'fitness',              color: '#55efc4', emoji: '🧘' },
  { id: 'naturaleza', name: 'Naturaleza',     icon: 'leaf',                 color: '#27ae60', emoji: '🌿' },
  { id: 'familia',    name: 'Familia',        icon: 'heart',                color: '#f9ca24', emoji: '👨‍👩‍👧' },
];

// Mapa id → objeto categoría para lookups O(1)
export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

// Mapa id → color (compatible con el CATEGORY_COLORS que usaba SearchScreen)
export const CATEGORY_COLORS = Object.fromEntries(CATEGORIES.map(c => [c.id, c.color]));

export const getCategoryById = (id) => CATEGORY_MAP[id] ?? null;
export const getCategoryColor = (id) => CATEGORY_COLORS[id] ?? '#6c5ce7';
export const getCategoryName  = (id) => CATEGORY_MAP[id]?.name ?? id;

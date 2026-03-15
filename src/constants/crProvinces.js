/**
 * Coordenadas del centro de cada provincia de Costa Rica.
 * Usadas como geopunto de referencia para eventos externos.
 */
export const CR_PROVINCES = {
  'San José': {
    lat: 9.9333,
    lng: -84.0833,
    label: 'San José',
  },
  'Alajuela': {
    lat: 10.0167,
    lng: -84.2167,
    label: 'Alajuela',
  },
  'Cartago': {
    lat: 9.8667,
    lng: -83.9167,
    label: 'Cartago',
  },
  'Heredia': {
    lat: 10.0000,
    lng: -84.1167,
    label: 'Heredia',
  },
  'Guanacaste': {
    lat: 10.3167,
    lng: -85.6167,
    label: 'Guanacaste',
  },
  'Puntarenas': {
    lat: 9.9758,
    lng: -84.8312,
    label: 'Puntarenas',
  },
  'Limón': {
    lat: 9.9833,
    lng: -83.0333,
    label: 'Limón',
  },
};

/**
 * Lista ordenada de provincias para iterar en el mapa.
 */
export const CR_PROVINCE_LIST = Object.values(CR_PROVINCES);

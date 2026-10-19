// Eventos de demostración para tomar capturas de pantalla.
//
// POR QUÉ NO ESTÁN EN FIRESTORE: las reglas exigen que
// `organizerId == request.auth.uid` al crear un evento, así que sembrar
// eventos con un organizador ficticio ("Costa Rica") requeriría una service
// account que saltee las reglas — un secreto más que manejar — y dejaría
// datos falsos en la base de producción que habría que acordarse de borrar
// antes de lanzar. Como solo hacen falta para las capturas, se inyectan acá.
//
// DOBLE CANDADO para que no lleguen nunca a un build de tienda:
//   1. DEMO_EVENTS_ENABLED, que se apaga a mano.
//   2. __DEV__, que es false en cualquier build de release.
// Alcanza con que uno de los dos sea false para que no se inyecte nada.
//
// Las fotos son de Wikimedia Commons (licencia libre) y el tema de cada una
// está confirmado por el título del archivo, no adivinado por la URL.

export const DEMO_EVENTS_ENABLED = true;

const COMMONS = 'https://upload.wikimedia.org/wikipedia/commons/thumb';

const IMG = {
  cafe:  `${COMMONS}/1/10/Coffee_harvested_costa_rica.jpg/1280px-Coffee_harvested_costa_rica.jpg`,
  maiz:  `${COMMONS}/8/83/Mazorcas_de_maiz_-_Mazarocas_de_millo_-_01.jpg/1280px-Mazorcas_de_maiz_-_Mazarocas_de_millo_-_01.jpg`,
  queso: `${COMMONS}/2/2f/Queso_Turrialba.jpg/1280px-Queso_Turrialba.jpg`,
  bingo: `${COMMONS}/c/c1/Bingo.jpg/1280px-Bingo.jpg`,
};

// El perfil "Costa Rica" organiza las tres ferias; el bingo lo arma una
// persona común, para que el feed muestre los dos tipos de organizador.
const CR    = { organizerId: 'demo-costa-rica', organizerName: 'Costa Rica',     organizerAvatar: '' };
const VECINA = { organizerId: 'demo-marieta',   organizerName: 'Marieta Vargas', organizerAvatar: '' };

// `date` va en DD/MM/YYYY y `time` en HH:MM (24h), igual que lo escribe
// CreateEventScreen. Tienen que ser futuras: el feed descarta las vencidas y
// el mapa filtra por `fecha >= hoy`.
function demo({ id, title, description, category, date, time, place, lat, lng, image, price = 0, org }) {
  return {
    id,
    title,
    description,
    category,
    date,
    time,
    location: { name: place, lat, lng },
    isVirtual: false,
    virtualLink: '',
    isFree: price === 0,
    price,
    ...org,
    images: [image],
    image,
    capacity: 0,
    hasParking: false,
    likes: [],
    attendees: [],
    savedBy: [],
    comments: [],
    createdAt: new Date(),
    _isDemo: true,
  };
}

export const DEMO_EVENTS = [
  demo({
    id: 'demo-bingo',
    title: 'Bingo bailable a beneficio del salón comunal',
    description:
      'Bingo de toda la vida para juntar plata y arreglar el techo del salón. ' +
      'Cartón a ₡2.500, hay chifrijo y café, y después se pone música. ' +
      'Traete la familia.',
    category: 'familia',
    date: '24/10/2026',
    time: '19:00',
    place: 'Salón Comunal de Guadalupe, Goicoechea',
    lat: 9.9489,
    lng: -84.0560,
    image: IMG.bingo,
    price: 2500,            // el único con precio
    org: VECINA,
  }),
  demo({
    id: 'demo-feria-cafe',
    title: 'Feria del Café de Naranjo',
    description:
      'Catación abierta con caficultores de la zona, venta de grano recién ' +
      'tostado y recorridos por el beneficio. Entrada libre todo el día.',
    category: 'comida',
    date: '25/10/2026',
    time: '09:00',
    place: 'Parque Central de Naranjo, Alajuela',
    lat: 10.0956,
    lng: -84.3792,
    image: IMG.cafe,
    org: CR,
  }),
  demo({
    id: 'demo-feria-maiz',
    title: 'Feria del Maíz de Upala',
    description:
      'Chorreadas, tamal asado, pozol y atol de maíz nuevo. Concurso de la ' +
      'mazorca más grande y baile con marimba al cerrar la tarde.',
    category: 'comida',
    date: '31/10/2026',
    time: '10:00',
    place: 'Plaza de Deportes de Upala, Alajuela',
    lat: 10.8983,
    lng: -85.0158,
    image: IMG.maiz,
    org: CR,
  }),
  demo({
    id: 'demo-feria-queso',
    title: 'Feria del Queso de Santa Cruz de Turrialba',
    description:
      'Queso Turrialba con denominación de origen, directo de las lecherías ' +
      'de la zona. Degustación, venta por kilo y tortillas de queso hechas ' +
      'al momento.',
    category: 'comida',
    date: '08/11/2026',
    time: '09:00',
    place: 'Santa Cruz de Turrialba, Cartago',
    lat: 10.0167,
    lng: -83.7667,
    image: IMG.queso,
    org: CR,
  }),
];

// Antepone los eventos de demo a los reales. Se llama desde un único lugar
// (subscribeToEvents), así que Home, Explorar y el mapa los ven todos.
export function withDemoEvents(events) {
  if (!__DEV__ || !DEMO_EVENTS_ENABLED) return events;
  return [...DEMO_EVENTS, ...events];
}

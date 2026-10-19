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
  // Foto tomada en San Marcos de Tarrazú, el mismo pueblo donde se hace la
  // Expo Café. No es una foto de la feria en sí: las que circulan en prensa y
  // redes tienen derechos de terceros y los enlaces se caen, así que se usa
  // una de licencia libre del lugar correcto.
  cafe:  `${COMMONS}/8/87/Coffee-cherry-picker-san-marcos-tarrazu-costa-rica.jpg/1280px-Coffee-cherry-picker-san-marcos-tarrazu-costa-rica.jpg`,
  maiz:  `${COMMONS}/8/83/Mazorcas_de_maiz_-_Mazarocas_de_millo_-_01.jpg/1280px-Mazorcas_de_maiz_-_Mazarocas_de_millo_-_01.jpg`,
  queso: `${COMMONS}/2/2f/Queso_Turrialba.jpg/1280px-Queso_Turrialba.jpg`,
  bingo: `${COMMONS}/c/c1/Bingo.jpg/1280px-Bingo.jpg`,
};

// El perfil "Costa Rica" organiza las tres ferias; el bingo lo arma una
// persona común, para que el feed muestre los dos tipos de organizador.
const CR    = { organizerId: 'demo-costa-rica', organizerName: 'Costa Rica',     organizerAvatar: '' };
const VECINA = { organizerId: 'demo-marieta',   organizerName: 'Marieta Vargas', organizerAvatar: '' };

// `date` va en DD/MM/YYYY y `time` en HH:MM (24h), igual que lo escribe
// CreateEventScreen.
//
// POR QUÉ LAS FECHAS SON DE 2027 Y NO LAS DE LA ÚLTIMA EDICIÓN REAL: el feed
// descarta los eventos vencidos (isExpired) y el mapa filtra por
// `fecha >= hoy`, así que un evento pasado sencillamente no se ve — que es lo
// contrario de lo que hace falta para tomar capturas. Las tres ferias son
// reales y conservan su mes de siempre; lo único movido es el año, a la
// próxima edición. Ver el detalle de cada una más abajo.
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
    title: 'Bingo en beneficio del salón comunal',
    description:
      'Bingo de toda la vida para juntar plata y arreglar el techo del salón. ' +
      'Cartón a ₡2.500, hay chifrijo y café, y después se pone música. ' +
      'Traete la familia.',
    category: 'familia',
    date: '24/10/2026',
    time: '19:00',
    place: 'Salón Comunal',
    lat: 9.9489,
    lng: -84.0560,
    image: IMG.bingo,
    price: 2500,            // el único con precio
    org: VECINA,
  }),
  // Feria real. Se hace en marzo en el Estadio Municipal de San Marcos, es
  // gratis y reúne a más de cien expositores. Celebra el café de Tarrazú, que
  // tiene Denominación de Origen desde 2021.
  // La edición de marzo de 2026 ya pasó, así que va la siguiente.
  demo({
    id: 'demo-expo-cafe-tarrazu',
    title: 'Expo Café Tarrazú',
    description:
      'Celebrá la cultura del café. Más de cien expositores con café de la ' +
      'zona, gastronomía local y artesanía, catación abierta, conciertos y ' +
      'actividades culturales. Entrada gratuita y pet friendly.',
    category: 'comida',
    date: '13/03/2027',
    time: '10:00',
    place: 'Estadio Municipal de San Marcos de Tarrazú',
    lat: 9.6547,
    lng: -84.0186,
    image: IMG.cafe,
    org: CR,
  }),
  // Feria real: la Fiesta del Maíz de Upala es tradición del 13 de octubre,
  // con coronación de la Reina del Maíz y desfile de trajes hechos con
  // tusa, granos y pelo de maíz. La de 2026 fue hace unos días.
  demo({
    id: 'demo-fiesta-maiz-upala',
    title: 'Fiesta del Maíz de Upala',
    description:
      'La celebración de la cosecha del maíz: coronación de la Reina del ' +
      'Maíz, desfile de trajes hechos con tusa y grano, artesanía y toda la ' +
      'comida típica de maíz — chorreadas, tamal asado, pozol y atol.',
    category: 'comida',
    date: '13/10/2027',
    time: '10:00',
    place: 'Upala, Alajuela',
    lat: 10.8983,
    lng: -85.0158,
    image: IMG.maiz,
    org: CR,
  }),
  // Feria real: la Expo Feria Nacional del Queso de Santa Cruz de Turrialba
  // existe desde el 2000 y va por la edición 23 (2025, del 6 al 8 de
  // setiembre). Su sello es el queso más grande del país, que se reparte
  // gratis el domingo.
  demo({
    id: 'demo-expo-feria-queso',
    title: 'Expo Feria Nacional del Queso',
    description:
      'Queso Turrialba con denominación de origen, directo de las lecherías ' +
      'de Santa Cruz. Degustación, venta por kilo, tortillas de queso hechas ' +
      'al momento y la elaboración del queso más grande de Costa Rica.',
    category: 'comida',
    date: '03/09/2027',
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

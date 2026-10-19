// Eventos de demostración para tomar capturas de pantalla.
//
// TODO ESTO ES TEMPORAL Y SE BORRA DESPUÉS DE LAS CAPTURAS. Para apagarlo sin
// borrar nada, poné DEMO_EVENTS_ENABLED en false. Para eliminarlo del todo:
// borrá este archivo y la llamada a withDemoEvents() en eventService.js.
//
// POR QUÉ NO ESTÁN EN FIRESTORE: las reglas exigen que
// `organizerId == request.auth.uid` al crear un evento, así que sembrar
// eventos con organizadores ficticios requeriría una service account que
// saltee las reglas — un secreto más que manejar — y dejaría datos falsos en
// la base de producción que habría que acordarse de borrar antes de lanzar.
//
// DOBLE CANDADO para que no lleguen nunca a un build de tienda:
//   1. DEMO_EVENTS_ENABLED, que se apaga a mano.
//   2. __DEV__, que es false en cualquier build de release.
// Alcanza con que uno de los dos sea false para que no se inyecte nada.
//
// Las fotos son de Wikimedia Commons (licencia libre) y el tema de cada una
// está confirmado por el título del archivo, no adivinado por la URL. Las
// nueve son horizontales a propósito: MediaCarousel solo encuadra a `cover`
// cuando el ratio pasa de 1.15, y con una vertical la tarjeta sale con marco
// desenfocado en vez de llenarse.

export const DEMO_EVENTS_ENABLED = true;

const COMMONS = 'https://upload.wikimedia.org/wikipedia/commons/thumb';

const IMG = {
  // Tomada en San Marcos de Tarrazú, el mismo pueblo donde se hace la Expo
  // Café. No es una foto de la feria en sí: las que circulan en prensa y redes
  // tienen derechos de terceros y los enlaces se caen.
  cafe:   `${COMMONS}/8/87/Coffee-cherry-picker-san-marcos-tarrazu-costa-rica.jpg/1280px-Coffee-cherry-picker-san-marcos-tarrazu-costa-rica.jpg`,
  maiz:   `${COMMONS}/8/83/Mazorcas_de_maiz_-_Mazarocas_de_millo_-_01.jpg/1280px-Mazorcas_de_maiz_-_Mazarocas_de_millo_-_01.jpg`,
  queso:  `${COMMONS}/2/2f/Queso_Turrialba.jpg/1280px-Queso_Turrialba.jpg`,
  bingo:  `${COMMONS}/2/2f/Bingo-carton-sandoval-de-la-reina-san-blas-febrero-2024.jpg/1280px-Bingo-carton-sandoval-de-la-reina-san-blas-febrero-2024.jpg`,
  musica: `${COMMONS}/7/72/Live_heavy_metal_band_performs_on_stage.jpg/1280px-Live_heavy_metal_band_performs_on_stage.jpg`,
  correr: `${COMMONS}/4/44/Lead_runners_in_York_Marathon_-_geograph.org.uk_-_8176678.jpg/1280px-Lead_runners_in_York_Marathon_-_geograph.org.uk_-_8176678.jpg`,
  feria:  `${COMMONS}/f/f6/Street_market_in_Marsaxlokk_12.jpg/1280px-Street_market_in_Marsaxlokk_12.jpg`,
  monte:  `${COMMONS}/3/37/White_Pass_Scenic_Byway_-_A_Hiking_Trail_in_Lowland_Forest_-_NARA_-_7722845.jpg/1280px-White_Pass_Scenic_Byway_-_A_Hiking_Trail_in_Lowland_Forest_-_NARA_-_7722845.jpg`,
  desfile:`${COMMONS}/b/be/Nibo_Carnival_Street_Parade.jpg/1280px-Nibo_Carnival_Street_Parade.jpg`,
  // Estas dos existen porque los eventos de tech y networking salen como
  // tiquete en Mis Planes: con la foto genérica de concierto que tenían antes,
  // una expo de tecnología quedaba ilustrada con una banda de heavy metal.
  hack:   `${COMMONS}/9/98/WTS_HACKATHON_2024.jpg/1280px-WTS_HACKATHON_2024.jpg`,
  salon:  `${COMMONS}/f/f6/Conferentiezaal_Conference_hall_%2852215585711%29.jpg/1280px-Conferentiezaal_Conference_hall_%2852215585711%29.jpg`,
};

// Nueve fotos para treinta y pico de eventos, así que se repiten. Para las
// capturas del mapa da igual (ahí solo se dibuja el pin de precio) y en el
// feed quedan separadas entre sí.
const PORCATEGORIA = {
  musica:     IMG.musica,
  fiesta:     IMG.desfile,
  deporte:    IMG.correr,
  arte:       IMG.feria,
  comida:     IMG.feria,
  tech:       IMG.hack,
  networking: IMG.salon,
  educacion:  IMG.cafe,
  cine:       IMG.musica,
  bienestar:  IMG.monte,
  naturaleza: IMG.monte,
  familia:    IMG.bingo,
};

const CR      = { organizerId: 'demo-costa-rica', organizerName: 'Costa Rica',     organizerAvatar: '' };
const VECINA  = { organizerId: 'demo-marieta',    organizerName: 'Marieta Vargas', organizerAvatar: '' };

// `date` va en DD/MM/YYYY y `time` en HH:MM (24h), igual que lo escribe
// CreateEventScreen.
const fmt = d =>
  `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;

// Fechas relativas a hoy en vez de fijas: así el relleno del mapa no se vence
// solo con el paso de los días. El feed descarta los eventos vencidos y el
// mapa filtra por `fecha >= hoy`, con lo cual una fecha fija terminaría
// vaciando el mapa sin que nadie se diera cuenta.
const enDias = n => { const d = new Date(); d.setDate(d.getDate() + n); return fmt(d); };

function demo({ id, title, description = '', category, date, time, place, lat, lng, image, price = 0, org }) {
  return {
    id, title, description, category, date, time,
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
    likes: [], attendees: [], savedBy: [], comments: [],
    createdAt: new Date(),
    _isDemo: true,
  };
}

// ─── Los cuatro con contenido escrito ────────────────────────────────────────

const DESTACADOS = [
  demo({
    id: 'demo-bingo',
    title: 'Bingo en beneficio del salón comunal',
    description:
      'Bingo de toda la vida para juntar plata y arreglar el techo del salón. ' +
      'Cartón a ₡2.500, hay chifrijo y café, y después se pone música. ' +
      'Traete la familia.',
    category: 'familia',
    date: enDias(6),
    time: '19:00',
    place: 'Salón Comunal',
    lat: 9.9489, lng: -84.0560,
    image: IMG.bingo,
    price: 2500,
    org: VECINA,
  }),
  // Feria real: se hace en marzo en el Estadio Municipal de San Marcos, es
  // gratis y reúne a más de cien expositores. Celebra el café de Tarrazú, que
  // tiene Denominación de Origen desde 2021. La edición de marzo de 2026 ya
  // pasó, así que acá va la siguiente.
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
    lat: 9.6547, lng: -84.0186,
    image: IMG.cafe,
    org: CR,
  }),

  // ATENCIÓN — estas dos NO SE VAN A VER en la app, y es a propósito.
  // Llevan la fecha real de su última edición, que ya pasó, y tanto el feed
  // (isExpired) como el mapa (fecha >= hoy) descartan los eventos vencidos.
  // Se dejan acá porque son ferias reales y sirven de referencia; para que
  // reaparezcan hay que ponerles una fecha futura.
  // Sin lugar específico: el sitio exacto de cada edición cambia y no se
  // inventa, así que solo va el cantón.
  demo({
    id: 'demo-fiesta-maiz-upala',
    title: 'Fiesta del Maíz de Upala',
    description:
      'La celebración de la cosecha del maíz: coronación de la Reina del ' +
      'Maíz, desfile de trajes hechos con tusa y grano, artesanía y toda la ' +
      'comida típica de maíz — chorreadas, tamal asado, pozol y atol.',
    category: 'comida',
    date: '13/10/2026',
    time: '10:00',
    place: 'Upala, Alajuela',
    lat: 10.8983, lng: -85.0158,
    image: IMG.maiz,
    org: CR,
  }),
  demo({
    id: 'demo-expo-feria-queso',
    title: 'Expo Feria Nacional del Queso',
    description:
      'Queso Turrialba con denominación de origen, directo de las lecherías ' +
      'de Santa Cruz. Degustación, venta por kilo, tortillas de queso hechas ' +
      'al momento y la elaboración del queso más grande de Costa Rica.',
    category: 'comida',
    date: '06/09/2026',
    time: '09:00',
    place: 'Santa Cruz de Turrialba, Cartago',
    lat: 10.0167, lng: -83.7667,
    image: IMG.queso,
    org: CR,
  }),
];

// ─── Relleno del mapa: 30 eventos por la GAM ─────────────────────────────────
// [título, categoría, lugar, lat, lng, precio (0 = gratis), día (desde hoy), hora]
// Coordenadas reales de cada cantón, para que los pines queden repartidos y no
// amontonados. La mezcla es de 14 gratuitos y 16 de paga.

const GAM = [
  // San José
  ['Concierto al aire libre en La Sabana',     'musica',     'Parque Metropolitano La Sabana',  9.9356, -84.0997,     0,  2, '16:00'],
  ['Noche de jazz en Escalante',               'musica',     'Barrio Escalante, San José',      9.9333, -84.0608,  8000,  3, '20:00'],
  ['Feria del agricultor de Zapote',           'comida',     'Zapote, San José',                9.9183, -84.0589,     0,  5, '06:00'],
  ['Carrera 10K Ciudad de San José',           'deporte',    'Paseo Colón, San José',           9.9333, -84.0897, 12000,  9, '07:00'],
  ['Festival gastronómico de Curridabat',      'comida',     'Curridabat, San José',            9.9178, -84.0333,     0,  7, '11:00'],
  ['Mercado de diseño en Escazú',              'arte',       'San Rafael de Escazú',            9.9189, -84.1372,     0,  4, '10:00'],
  ['Stand up comedy en Santa Ana',             'fiesta',     'Santa Ana, San José',             9.9325, -84.1842,  6000,  8, '21:00'],
  ['Cine al aire libre en Moravia',            'cine',       'Moravia, San José',               9.9589, -84.0506,     0, 11, '18:30'],
  ['Yoga al amanecer en el Parque del Este',   'bienestar',  'San Pedro, Montes de Oca',        9.9344, -84.0531,  4000,  6, '06:30'],
  ['Feria navideña de Tibás',                  'familia',    'Tibás, San José',                 9.9589, -84.0828,     0, 14, '15:00'],
  ['Torneo de fútbol 5 en Pavas',              'deporte',    'Pavas, San José',                 9.9458, -84.1256, 10000, 12, '18:00'],
  ['Bingo familiar de Desamparados',           'familia',    'Desamparados, San José',          9.8989, -84.0658,  2000, 10, '19:00'],
  // Coronado y no Guadalupe: el bingo ya ocupa ese punto exacto y los dos
  // pines quedaban uno encima del otro en el mapa.
  ['Noche de karaoke en Coronado',             'fiesta',     'San Isidro de Coronado',          9.9794, -84.0003,     0, 13, '20:00'],
  ['Taller de barismo en Barrio Amón',         'educacion',  'Barrio Amón, San José',           9.9389, -84.0778, 15000, 16, '14:00'],

  // Heredia
  ['Festival de la Luz de Heredia',            'fiesta',     'Heredia centro',                  9.9981, -84.1197,     0, 18, '18:00'],
  ['Expo tecnología en Belén',                 'tech',       'San Antonio de Belén, Heredia',   9.9889, -84.1831,  9000, 15, '09:00'],
  ['Caminata al Volcán Barva',                 'naturaleza', 'Barva, Heredia',                 10.0247, -84.1203,  5000, 20, '05:30'],
  ['Feria artesanal de Santo Domingo',         'arte',       'Santo Domingo, Heredia',          9.9797, -84.0919,     0, 17, '10:00'],
  ['Concierto de marimba en San Rafael',       'musica',     'San Rafael de Heredia',          10.0186, -84.0889,     0, 21, '17:00'],
  ['Networking de emprendedores',              'networking', 'San Joaquín de Flores, Heredia',  9.9931, -84.1611,  7000, 19, '18:30'],

  // Alajuela
  ['Fiestas cívicas de Alajuela',              'fiesta',     'Alajuela centro',                10.0162, -84.2116,  3000, 23, '19:00'],
  ['Feria del mango en Atenas',                'comida',     'Atenas, Alajuela',                9.9789, -84.3828,     0, 25, '09:00'],
  ['Carrera de montaña en Grecia',             'deporte',    'Grecia, Alajuela',               10.0725, -84.3122, 11000, 27, '07:00'],
  ['Festival de música en San Ramón',          'musica',     'San Ramón, Alajuela',            10.0892, -84.4717,  8500, 24, '19:30'],
  ['Tour de cafetales en Naranjo',             'naturaleza', 'Naranjo, Alajuela',              10.0956, -84.3792, 14000, 26, '08:00'],
  ['Feria de emprendedores de Palmares',       'networking', 'Palmares, Alajuela',             10.0556, -84.4356,     0, 28, '10:00'],

  // Cartago
  ['Romería nocturna a la Basílica',           'familia',    'Cartago centro',                  9.8644, -83.9194,     0, 30, '19:00'],
  ['Festival de jardines en Paraíso',          'naturaleza', 'Paraíso, Cartago',                9.8383, -83.8642,  4500, 32, '09:00'],
  ['Feria del libro en Tres Ríos',             'educacion',  'La Unión, Cartago',               9.9069, -83.9756,     0, 29, '10:00'],
  ['Noche de tamales en Oreamuno',             'comida',     'Oreamuno, Cartago',               9.8872, -83.9078,  5000, 31, '17:00'],
];

const RELLENO = GAM.map(([title, category, place, lat, lng, price, dia, time], i) =>
  demo({
    id: `demo-gam-${i + 1}`,
    title, category, place, lat, lng, price, time,
    date: enDias(dia),
    image: PORCATEGORIA[category] ?? IMG.feria,
    org: CR,
  })
);

export const DEMO_EVENTS = [...DESTACADOS, ...RELLENO];

// Antepone los eventos de demo a los reales. Se llama desde un único lugar
// (subscribeToEvents), así que Home, Explorar y el mapa los ven todos.
export function withDemoEvents(events) {
  if (!__DEV__ || !DEMO_EVENTS_ENABLED) return events;
  return [...DEMO_EVENTS, ...events];
}

// ─── Entradas en "Mis planes" ────────────────────────────────────────────────
// Los eventos que se muestran como si el usuario ya tuviera la entrada. El
// más próximo de los tres sale como TicketCard grande — la tarjeta amarilla
// con perforación — y los otros dos en la lista de abajo.
//
// MyPlansScreen no pasa por subscribeToEvents: consulta Firestore directo con
// `where('attendees','array-contains', uid)`. Por eso hace falta este segundo
// punto de inyección, que se llama desde esa suscripción.
const CON_ENTRADA = [
  'demo-gam-16', // Expo tecnología en Belén
  'demo-gam-17', // Caminata al Volcán Barva
  'demo-gam-20', // Networking de emprendedores
];

export function withDemoAttending(events) {
  if (!__DEV__ || !DEMO_EVENTS_ENABLED) return events;
  const mios = DEMO_EVENTS.filter(e => CON_ENTRADA.includes(e.id));
  if (mios.length !== CON_ENTRADA.length) {
    // Si alguien reordena el array GAM, los ids dejan de apuntar a lo que
    // dice el comentario de arriba. Mejor enterarse que quedarse sin tiquete.
    console.warn(
      `[demoEvents] CON_ENTRADA esperaba ${CON_ENTRADA.length} eventos y encontró ${mios.length}. ` +
      'Revisá que los ids sigan existiendo en DEMO_EVENTS.'
    );
  }
  return [...mios, ...events];
}

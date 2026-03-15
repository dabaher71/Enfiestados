const axios = require('axios');
const cheerio = require('cheerio');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, GeoPoint, Timestamp } = require('firebase-admin/firestore');

// ─── Firebase Admin ───────────────────────────────────────────────────────────
// Ajustamos la ruta para subir un nivel si el script está en la carpeta /scripts
const serviceAccount = require('../serviceAccountKey.json'); 

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

// ─── Diccionario de Provincias ────────────────────────────────────────────────
const PROVINCE_COORDS = {
  'San José':    { lat: 9.9333,  lng: -84.0833 },
  'Alajuela':    { lat: 10.0167, lng: -84.2167 },
  'Cartago':     { lat: 9.8667,  lng: -83.9167 },
  'Heredia':     { lat: 10.0000, lng: -84.1167 },
  'Guanacaste':  { lat: 10.3167, lng: -85.6167 },
  'Puntarenas':  { lat: 9.9758,  lng: -84.8312 },
  'Limón':       { lat: 9.9833,  lng: -83.0333 },
};

// Cantones/distritos → provincia
const LOCATION_MAP = [
  // San José — incluye venues culturales comunes de GAM Cultural
  { keywords: ['San José', 'Escazú', 'Desamparados', 'Puriscal', 'Tarrazú',
               'Aserrí', 'Mora', 'Goicoechea', 'Santa Ana', 'Alajuelita',
               'Vásquez de Coronado', 'Acosta', 'Tibás', 'Moravia', 'Montes de Oca',
               'Turrubares', 'Dota', 'Curridabat', 'Pérez Zeledón', 'León Cortés',
               // Venues GAM Cultural frecuentes en San José:
               'Teatro Nacional', 'Teatro Melico', 'Teatro Popular', 'CENAC',
               'Centro Nacional de la Cultura', 'Museo de Arte', 'MADC',
               'Teatro Vargas Calvo', 'Teatro Laurence Olivier', 'Teatro Fanal',
               'Auditorio Nacional', 'Centro Cultural España', 'CCE',
               'Teatro 1887', 'Sala Garbo', 'Cine Magaly', 'Centro de Cine',
               'Museo Nacional', 'Parque La Sabana', 'Sabana', 'Paseo Colón',
               'Barrio Amón', 'Barrio Escalante', 'La California', 'Calle de la Amargura'],
    province: 'San José' },
  // Alajuela
  { keywords: ['Alajuela', 'San Ramón', 'Grecia', 'San Mateo', 'Atenas',
               'Naranjo', 'Palmares', 'Poás', 'Orotina', 'San Carlos',
               'Zarcero', 'Sarchí', 'Upala', 'Los Chiles', 'Guatuso',
               'Río Cuarto', 'Ciudad Quesada', 'La Fortuna'],
    province: 'Alajuela' },
  // Cartago
  { keywords: ['Cartago', 'Paraíso', 'La Unión', 'Jiménez', 'Turrialba',
               'Alvarado', 'Oreamuno', 'El Guarco', 'Tres Ríos'],
    province: 'Cartago' },
  // Heredia
  { keywords: ['Heredia', 'Barva', 'Santo Domingo', 'Santa Bárbara', 'San Rafael',
               'San Isidro', 'Belén', 'Flores', 'San Pablo', 'Sarapiquí'],
    province: 'Heredia' },
  // Guanacaste
  { keywords: ['Guanacaste', 'Liberia', 'Nicoya', 'Santa Cruz', 'Bagaces',
               'Carrillo', 'Cañas', 'Abangares', 'Tilarán', 'Nandayure',
               'La Cruz', 'Hojancha', 'Tamarindo', 'Nosara', 'Sámara'],
    province: 'Guanacaste' },
  // Puntarenas
  { keywords: ['Puntarenas', 'Esparza', 'Buenos Aires', 'Montes de Oro',
               'Osa', 'Quepos', 'Golfito', 'Coto Brus', 'Parrita',
               'Corredores', 'Garabito', 'Manuel Antonio', 'Jacó', 'Dominical'],
    province: 'Puntarenas' },
  // Limón
  { keywords: ['Limón', 'Pococí', 'Siquirres', 'Talamanca', 'Matina',
               'Guácimo', 'Cahuita', 'Puerto Viejo', 'Batán'],
    province: 'Limón' },
];

// Mapa de abreviaturas de meses en español (mayúsculas y título)
const MONTH_ES = {
  ENE: 0, FEB: 1, MAR: 2, ABR: 3, MAY: 4, JUN: 5,
  JUL: 6, AGO: 7, SEP: 8, OCT: 9, NOV: 10, DIC: 11,
  Ene: 0, Feb: 1, Mar: 2, Abr: 3, May: 4, Jun: 5,
  Jul: 6, Ago: 7, Sep: 8, Oct: 9, Nov: 10, Dic: 11,
};

/**
 * Intenta convertir un texto de fecha libre a ISO string.
 * Soporta:
 *   GAM Cultural: "DOM 29 MAR"
 *   EventCR:      "Sáb. 14 Mar 09:00 PM"
 * Si el día/mes ya pasó más de una semana, asume el año siguiente.
 * Retorna null si no puede parsear.
 */
function parseDateToISO(dateText) {
  if (!dateText) return null;
  // Quitar puntos de abreviaturas ("Sáb." → "Sáb") y dividir en tokens
  const tokens = dateText.replace(/\./g, '').split(/[\s,/-]+/);
  let day = null;
  let monthIdx = null;

  for (const token of tokens) {
    if (/^\d{1,2}$/.test(token) && day === null) {
      day = parseInt(token, 10);
    }
    if (MONTH_ES[token] !== undefined) {
      monthIdx = MONTH_ES[token];
    }
  }

  if (day === null || monthIdx === null) return null;

  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(year, monthIdx, day);

  // Si ya pasó hace más de 7 días, es del año siguiente
  if (candidate < now && (now - candidate) > 7 * 24 * 60 * 60 * 1000) {
    year++;
  }

  return new Date(year, monthIdx, day).toISOString();
}

/**
 * Dado un texto de lugar, devuelve las coordenadas del centro de la provincia.
 * Si no hay coincidencia, usa San José como fallback.
 */
function resolveCoords(locationText = '') {
  const text = locationText.toLowerCase();
  for (const entry of LOCATION_MAP) {
    if (entry.keywords.some(kw => text.includes(kw.toLowerCase()))) {
      return PROVINCE_COORDS[entry.province];
    }
  }
  // Fallback: San José
  return PROVINCE_COORDS['San José'];
}

// ─── Utilidades ───────────────────────────────────────────────────────────────
function toBase64Id(url) {
  return Buffer.from(url).toString('base64').replace(/[/=+]/g, '_');
}

async function fetchHTML(url) {
  const { data } = await axios.get(url, {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; EnfiestadosBot/1.0)',
    },
  });
  return data;
}

// ─── Scraper: GAM Cultural ────────────────────────────────────────────────────
// Estructura real (inspeccionada 2026-03):
//   Cada evento: <li class="viral-item viral-event ...">
//   Título:      .viral-event-title a.viral-linked span
//   URL:         .viral-event-title a.viral-linked[href]
//   Imagen:      .viral-event-image[data-img]
//   Fecha:       .viral-event-weekday + .viral-event-day + .viral-event-month
//   Lugar:       .viral-event-place (venue) + .node-name (ciudad/nodo)
//   Descripción: NO está en el listado → se obtiene del JSON-LD de cada página individual

// Obtiene la descripción del JSON-LD en la página de detalle de GAM Cultural
async function fetchGAMDescription(eventUrl) {
  try {
    const html = await fetchHTML(eventUrl);
    const $ = cheerio.load(html);
    const scriptContent = $('#viral-single-content script[type="application/ld+json"]').html();
    if (!scriptContent) return '';
    const jsonLd = JSON.parse(scriptContent.trim());
    return jsonLd.description || '';
  } catch {
    return '';
  }
}

async function scrapeGAMCultural() {
  const BASE_URL = 'https://www.gamcultural.com';
  const LIST_URL = `${BASE_URL}/cr/home`;

  console.log('[GAM Cultural] Iniciando extracción...');
  const basicEvents = [];

  try {
    const html = await fetchHTML(LIST_URL);
    const $ = cheerio.load(html);

    $('li.viral-item.viral-event').each((_, el) => {
      try {
        const card = $(el);

        // ── Título
        const title = card.find('.viral-event-title a.viral-linked span').first().text().trim()
          || card.find('.viral-event-title a').first().text().trim();
        if (!title) return;

        // ── URL
        const relativeHref = card.find('.viral-event-title a.viral-linked').first().attr('href') || '';
        const eventUrl = relativeHref.startsWith('http')
          ? relativeHref
          : `${BASE_URL}${relativeHref}`;

        // ── Imagen
        const imageUrl = card.find('.viral-event-image').first().attr('data-img') || '';

        // ── Fecha
        const weekday  = card.find('.viral-event-weekday').first().text().trim();
        const day      = card.find('.viral-event-day').first().text().trim();
        const month    = card.find('.viral-event-month').first().text().trim();
        const dateText = [weekday, day, month].filter(Boolean).join(' ');

        // ── Ubicación: venue (.viral-event-place) + nodo/ciudad (.node-name)
        const venueText = card.find('.viral-event-place').first().text().trim();
        const nodeText  = card.find('.node-name').first().text().trim();
        const locationText = [venueText, nodeText].filter(Boolean).join(', ');

        basicEvents.push({ title, imageUrl, dateText, locationText, eventUrl });
      } catch (err) {
        console.warn('[GAM Cultural] Error parseando card:', err.message);
      }
    });

    console.log(`[GAM Cultural] ${basicEvents.length} eventos en listado. Obteniendo descripciones...`);
  } catch (err) {
    console.error('[GAM Cultural] Error al hacer fetch del listado:', err.message);
    return [];
  }

  // Fetch individual: descripción desde JSON-LD de cada página
  const events = [];
  for (const ev of basicEvents) {
    const description = await fetchGAMDescription(ev.eventUrl);
    const coords = resolveCoords(ev.locationText || ev.title);
    events.push({
      ...ev,
      description,
      dateISO: parseDateToISO(ev.dateText),
      source: 'GAM Cultural',
      coords,
    });
    await new Promise(r => setTimeout(r, 250)); // pausa para no saturar el servidor
  }

  console.log(`[GAM Cultural] ${events.length} eventos completos.`);

  return events;
}

// ─── Scraper: EventCR ─────────────────────────────────────────────────────────
// Estructura real (inspeccionada 2026-03):
//   Cada evento: <a href="eventPage.php?id=ID" class="event-link">
//   Título:      h3.event-title
//   URL:         a.event-link[href]  → relativo "eventPage.php?id=123"
//   Imagen:      img.event-img[src]  (hosteada en S3)
//   Fecha:       .meta-line          → "Sáb. 14 Mar 09:00 PM"
//   Lugar:       p.event-venue
//   Descripción: NO está en el listado → sección .seat-info en la página individual

// Obtiene la descripción de la sección .seat-info en la página de detalle de EventCR
async function fetchEventCRDescription(eventUrl) {
  try {
    const html = await fetchHTML(eventUrl);
    const $ = cheerio.load(html);
    const seatInfo = $('.seat-info');
    if (!seatInfo.length) return '';
    // Recoge todos los párrafos dentro de .seat-info (excluye el h4 de título)
    const paragraphs = seatInfo.find('p').map((_, el) => $(el).text().trim()).get().filter(Boolean);
    return paragraphs.join(' ').trim();
  } catch {
    return '';
  }
}

async function scrapeEventCR() {
  const BASE_URL = 'https://eventcr.com';

  console.log('[EventCR] Iniciando extracción...');
  const basicEvents = [];

  try {
    const html = await fetchHTML(BASE_URL);
    const $ = cheerio.load(html);

    $('a.event-link').each((_, el) => {
      try {
        const anchor = $(el);

        // ── Título
        const title = anchor.find('h3.event-title').first().text().trim();
        if (!title) return;

        // ── URL directa al evento (relativa → absoluta)
        const relativeHref = anchor.attr('href') || '';
        const eventUrl = relativeHref.startsWith('http')
          ? relativeHref
          : `${BASE_URL}/${relativeHref.replace(/^\//, '')}`;

        // ── Imagen (src estándar, S3)
        const imageUrl = anchor.find('img.event-img').first().attr('src') || '';

        // ── Fecha: el span .meta-date tiene <br> entre fecha y hora → reemplazar antes de .text()
        const metaDateEl = anchor.find('.meta-date').first();
        const dateText = (metaDateEl.html() || anchor.find('.meta-line').first().html() || '')
          .replace(/<br\s*\/?>/gi, ' ')
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        // ── Lugar
        const locationText = anchor.find('p.event-venue').first().text().trim();

        basicEvents.push({ title, imageUrl, dateText, locationText, eventUrl });
      } catch (err) {
        console.warn('[EventCR] Error parseando card:', err.message);
      }
    });

    console.log(`[EventCR] ${basicEvents.length} eventos en listado. Obteniendo descripciones...`);
  } catch (err) {
    console.error('[EventCR] Error al hacer fetch:', err.message);
    return [];
  }

  // Fetch individual: descripción desde .seat-info de cada página
  const events = [];
  for (const ev of basicEvents) {
    const description = await fetchEventCRDescription(ev.eventUrl);
    const coords = resolveCoords(ev.locationText || ev.title);
    events.push({
      ...ev,
      description,
      dateISO: parseDateToISO(ev.dateText),
      source:  'EventCR',
      coords,
    });
    await new Promise(r => setTimeout(r, 250));
  }

  console.log(`[EventCR] ${events.length} eventos completos.`);
  return events;
}

// ─── Guardar en Firestore ─────────────────────────────────────────────────────
async function saveEvents(events) {
  if (!events.length) {
    console.log('Sin eventos para guardar.');
    return;
  }

  const batch = db.batch();
  let count = 0;

  for (const event of events) {
    if (!event.eventUrl || !event.title) continue;

    const docId = toBase64Id(event.eventUrl);
    const ref = db.collection('eventos_externos').doc(docId);

    batch.set(
      ref,
      {
        title:        event.title,
        imageUrl:     event.imageUrl    || '',
        dateText:     event.dateText    || '',
        dateISO:      event.dateISO     || null,
        locationText: event.locationText || '',
        description:  event.description || '',
        eventUrl:     event.eventUrl,
        source:       event.source,
        geopunto:     new GeoPoint(event.coords.lat, event.coords.lng),
        updatedAt:    Timestamp.now(),
      },
      { merge: true } // no sobreescribe campos que no mandamos
    );

    count++;
    // Firestore batch limit = 500
    if (count % 499 === 0) {
      await batch.commit();
      console.log(`Guardados ${count} eventos...`);
    }
  }

  await batch.commit();
  console.log(`✓ Total guardado: ${count} eventos en eventos_externos.`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  try {
    const [gamEvents, eventCREvents] = await Promise.all([
      scrapeGAMCultural(),
      scrapeEventCR(),
    ]);

    const all = [...gamEvents, ...eventCREvents];
    console.log(`\nTotal extraído: ${all.length} eventos.`);
    await saveEvents(all);
  } catch (err) {
    console.error('Error en main:', err);
    process.exit(1);
  }
}

main();

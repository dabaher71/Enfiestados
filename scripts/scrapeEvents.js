/**
 * scrapeEvents.js — Importador de eventos externos a Firestore
 *
 * Fuentes:
 *   [Cheerio/axios] GAM Cultural, EventCR, Smarticket, Eticket.cr
 *   [Puppeteer]     SpecialTicket, TiqueteBox, StarTicket  (JS-rendered / 403)
 *
 * Uso:
 *   node scripts/scrapeEvents.js                  # todas las fuentes
 *   node scripts/scrapeEvents.js --only=smarticket # solo una fuente
 *   node scripts/scrapeEvents.js --skip=puppeteer  # omitir fuentes que requieren Puppeteer
 *
 * Dependencias:
 *   npm install axios cheerio firebase-admin
 *   npm install puppeteer   ← solo para SpecialTicket / TiqueteBox / StarTicket
 */

const axios   = require('axios');
const cheerio = require('cheerio');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, GeoPoint, Timestamp } = require('firebase-admin/firestore');

const serviceAccount = require('../serviceAccountKey.json');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ─── Args ─────────────────────────────────────────────────────────────────────
const args        = process.argv.slice(2);
const onlyArg     = args.find(a => a.startsWith('--only='))?.split('=')[1]?.toLowerCase();
const skipPuppeteer = args.includes('--skip=puppeteer');

// ─── Coordenadas de provincias ────────────────────────────────────────────────
const PROVINCE_COORDS = {
  'San José':   { lat: 9.9333,  lng: -84.0833 },
  'Alajuela':   { lat: 10.0167, lng: -84.2167 },
  'Cartago':    { lat: 9.8667,  lng: -83.9167 },
  'Heredia':    { lat: 10.0000, lng: -84.1167 },
  'Guanacaste': { lat: 10.3167, lng: -85.6167 },
  'Puntarenas': { lat: 9.9758,  lng: -84.8312 },
  'Limón':      { lat: 9.9833,  lng: -83.0333 },
};

const LOCATION_MAP = [
  { keywords: ['San José','Escazú','Desamparados','Puriscal','Aserrí','Mora','Goicoechea',
               'Santa Ana','Alajuelita','Tibás','Moravia','Montes de Oca','Curridabat',
               'Teatro Nacional','Teatro Melico','Teatro Popular','CENAC','Auditorio Nacional',
               'Centro Nacional de la Cultura','Museo de Arte','MADC','Parque La Sabana',
               'Sabana','Paseo Colón','Barrio Amón','Barrio Escalante','La California',
               'Calle de la Amargura','San Jose','SAN JOSE','SAN JOSÉ'],
    province: 'San José' },
  { keywords: ['Alajuela','San Ramón','Grecia','Atenas','Naranjo','Palmares','San Carlos',
               'La Fortuna','Ciudad Quesada','ALAJUELA'],
    province: 'Alajuela' },
  { keywords: ['Cartago','Paraíso','La Unión','Turrialba','Tres Ríos','CARTAGO'],
    province: 'Cartago' },
  { keywords: ['Heredia','Barva','Santo Domingo','Santa Bárbara','San Pablo','HEREDIA'],
    province: 'Heredia' },
  { keywords: ['Guanacaste','Liberia','Nicoya','Santa Cruz','Tamarindo','Nosara','Sámara','GUANACASTE'],
    province: 'Guanacaste' },
  { keywords: ['Puntarenas','Quepos','Jacó','Manuel Antonio','Dominical','Golfito','PUNTARENAS'],
    province: 'Puntarenas' },
  { keywords: ['Limón','Pococí','Siquirres','Cahuita','Puerto Viejo','LIMÓN','LIMON'],
    province: 'Limón' },
];

const MONTH_ES = {
  ENE:0,FEB:1,MAR:2,ABR:3,MAY:4,JUN:5,JUL:6,AGO:7,SEP:8,OCT:9,NOV:10,DIC:11,
  Ene:0,Feb:1,Mar:2,Abr:3,May:4,Jun:5,Jul:6,Ago:7,Sep:8,Oct:9,Nov:10,Dic:11,
  ENERO:0,FEBRERO:1,MARZO:2,ABRIL:3,MAYO:4,JUNIO:5,JULIO:6,AGOSTO:7,
  SEPTIEMBRE:8,SETIEMBRE:8,OCTUBRE:9,NOVIEMBRE:10,DICIEMBRE:11,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function resolveCoords(text = '') {
  const t = text.toLowerCase();
  for (const e of LOCATION_MAP) {
    if (e.keywords.some(k => t.includes(k.toLowerCase()))) return PROVINCE_COORDS[e.province];
  }
  return PROVINCE_COORDS['San José'];
}

function parseDateToISO(dateText) {
  if (!dateText) return null;
  // Formato DD/MM/YYYY  o  DD/MM/YY
  const slashMatch = dateText.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slashMatch) {
    let [, d, m, y] = slashMatch;
    if (y.length === 2) y = '20' + y;
    return new Date(+y, +m - 1, +d).toISOString();
  }
  // Formato "domingo, 17 de mayo de 2026"
  const longMatch = dateText.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
  if (longMatch) {
    const [, d, mesStr, y] = longMatch;
    const mIdx = MONTH_ES[mesStr.slice(0,3).toUpperCase()] ?? MONTH_ES[mesStr.charAt(0).toUpperCase() + mesStr.slice(1,3)];
    if (mIdx !== undefined) return new Date(+y, mIdx, +d).toISOString();
  }
  // Formato tokens "DOM 29 MAR", "Sáb 14 Mar"
  const tokens = dateText.replace(/\./g, '').split(/[\s,/-]+/);
  let day = null, monthIdx = null;
  for (const t of tokens) {
    if (/^\d{1,2}$/.test(t) && day === null) day = parseInt(t, 10);
    const key = t.slice(0,3).toUpperCase();
    if (MONTH_ES[key] !== undefined) monthIdx = MONTH_ES[key];
  }
  if (day !== null && monthIdx !== null) {
    const now = new Date();
    let year = now.getFullYear();
    const candidate = new Date(year, monthIdx, day);
    if (candidate < now && (now - candidate) > 7 * 86400000) year++;
    return new Date(year, monthIdx, day).toISOString();
  }
  return null;
}

function toBase64Id(url) {
  return Buffer.from(url).toString('base64').replace(/[/=+]/g, '_');
}

async function fetchHTML(url, extraHeaders = {}) {
  const { data, headers } = await axios.get(url, {
    timeout: 20000,
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-CR,es;q=0.9,en;q=0.8',
      ...extraHeaders,
    },
  });
  const ct = (headers['content-type'] || '').toLowerCase();
  const charset = ct.match(/charset=([\w-]+)/)?.[1] || 'utf-8';
  const isLatin = /iso-8859|windows-1252|latin/.test(charset);
  return Buffer.from(data).toString(isLatin ? 'latin1' : 'utf8');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── 1. GAM Cultural ──────────────────────────────────────────────────────────
async function fetchGAMDescription(eventUrl) {
  try {
    const html = await fetchHTML(eventUrl);
    const $ = cheerio.load(html);
    const scriptContent = $('#viral-single-content script[type="application/ld+json"]').html();
    if (!scriptContent) return '';
    return JSON.parse(scriptContent.trim()).description || '';
  } catch { return ''; }
}

async function scrapeGAMCultural() {
  const BASE = 'https://www.gamcultural.com';
  console.log('[GAM Cultural] Iniciando...');
  const basicEvents = [];
  try {
    const html = await fetchHTML(`${BASE}/cr/home`);
    const $ = cheerio.load(html);
    $('li.viral-item.viral-event').each((_, el) => {
      try {
        const card = $(el);
        const title = card.find('.viral-event-title a.viral-linked span').first().text().trim()
          || card.find('.viral-event-title a').first().text().trim();
        if (!title) return;
        const relHref = card.find('.viral-event-title a.viral-linked').first().attr('href') || '';
        const eventUrl = relHref.startsWith('http') ? relHref : `${BASE}${relHref}`;
        const imageUrl = card.find('.viral-event-image').first().attr('data-img') || '';
        const weekday  = card.find('.viral-event-weekday').first().text().trim();
        const day      = card.find('.viral-event-day').first().text().trim();
        const month    = card.find('.viral-event-month').first().text().trim();
        const dateText = [weekday, day, month].filter(Boolean).join(' ');
        const venueText = card.find('.viral-event-place').first().text().trim();
        const nodeText  = card.find('.node-name').first().text().trim();
        const locationText = [venueText, nodeText].filter(Boolean).join(', ');
        basicEvents.push({ title, imageUrl, dateText, locationText, eventUrl });
      } catch {}
    });
  } catch (err) { console.error('[GAM Cultural] Error listado:', err.message); return []; }

  const events = [];
  for (const ev of basicEvents) {
    const description = await fetchGAMDescription(ev.eventUrl);
    events.push({ ...ev, description, dateISO: parseDateToISO(ev.dateText),
      source: 'GAM Cultural', coords: resolveCoords(ev.locationText || ev.title) });
    await sleep(300);
  }
  console.log(`[GAM Cultural] ${events.length} eventos.`);
  return events;
}

// ─── 2. EventCR ───────────────────────────────────────────────────────────────
async function fetchEventCRDescription(eventUrl) {
  try {
    const html = await fetchHTML(eventUrl);
    const $ = cheerio.load(html);
    return $('.seat-info').find('p').map((_, el) => $(el).text().trim()).get().filter(Boolean).join(' ');
  } catch { return ''; }
}

async function scrapeEventCR() {
  const BASE = 'https://eventcr.com';
  console.log('[EventCR] Iniciando...');
  const basicEvents = [];
  try {
    const html = await fetchHTML(BASE);
    const $ = cheerio.load(html);
    $('a.event-link').each((_, el) => {
      try {
        const anchor = $(el);
        const title = anchor.find('h3.event-title').first().text().trim();
        if (!title) return;
        const relHref = anchor.attr('href') || '';
        const eventUrl = relHref.startsWith('http') ? relHref : `${BASE}/${relHref.replace(/^\//, '')}`;
        const imageUrl = anchor.find('img.event-img').first().attr('src') || '';
        const dateText = (anchor.find('.meta-date').first().html() || anchor.find('.meta-line').first().html() || '')
          .replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        const locationText = anchor.find('p.event-venue').first().text().trim();
        basicEvents.push({ title, imageUrl, dateText, locationText, eventUrl });
      } catch {}
    });
  } catch (err) { console.error('[EventCR] Error:', err.message); return []; }

  const events = [];
  for (const ev of basicEvents) {
    const description = await fetchEventCRDescription(ev.eventUrl);
    events.push({ ...ev, description, dateISO: parseDateToISO(ev.dateText),
      source: 'EventCR', coords: resolveCoords(ev.locationText) });
    await sleep(300);
  }
  console.log(`[EventCR] ${events.length} eventos.`);
  return events;
}

// ─── 3. Smarticket ────────────────────────────────────────────────────────────
async function fetchSmarticketDetail(eventUrl) {
  try {
    const html = await fetchHTML(eventUrl);
    const $ = cheerio.load(html);

    // Título: Smarticket lo pone en <strong> junto con la fecha
    // Patrón: "<strong>NOMBRE EVENTO</strong> DD/MM/YYYY HH:MM AM/PM"
    // También puede aparecer en <h3> en algunos eventos
    let title = '';
    $('strong').each((_, el) => {
      const t = $(el).text().trim();
      // El strong del título no tiene números de fecha
      if (t.length > 3 && !t.match(/^\d/) && !t.match(/adquirir|entrada|sector|lugar/i)) {
        title = t;
        return false; // break
      }
    });
    if (!title) {
      title = $('h3').filter((_, el) => {
        const t = $(el).text().trim();
        return t.length > 3 && !t.match(/haz click|sector|selecciona/i);
      }).first().text().trim();
    }

    // Fecha y hora: buscar patrón DD/MM/YYYY dentro del texto del body
    const bodyText = $('body').text();
    const dateMatch = bodyText.match(/(\d{2}\/\d{2}\/\d{4})/);
    const timeMatch = bodyText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/);
    const dateText  = dateMatch ? `${dateMatch[1]}${timeMatch ? ' ' + timeMatch[1] : ''}` : '';

    // Venue: texto corto que no sea título ni fecha ni instrucción
    let locationText = '';
    $('strong, b').each((_, el) => {
      const t = $(el).text().trim();
      if (t.length > 3 && t.length < 80 && t !== title &&
          !t.match(/\d{2}\/\d{2}/) && !t.match(/adquirir|entrada|selecciona|sector|haz click/i)) {
        if (!locationText) locationText = t;
      }
    });

    // Imagen: está en el style de un <section> como background: url('...')
    let imageUrl = '';
    $('[style]').each((_, el) => {
      const style = $(el).attr('style') || '';
      const match = style.match(/url\(['"](https?:\/\/[^'"]+)['"]\)/);
      if (match && !match[1].includes('logo') && !match[1].includes('costarica')) {
        imageUrl = match[1];
        return false; // break
      }
    });
    if (!imageUrl) imageUrl = $('meta[property="og:image"]').attr('content') || '';

    return { title, dateText, locationText, imageUrl };
  } catch { return {}; }
}

async function scrapeSmarticket() {
  const BASE = 'https://smarticket.net';
  console.log('[Smarticket] Iniciando...');
  const seen = new Set();
  const basicEvents = [];

  try {
    const html = await fetchHTML(BASE);
    const $ = cheerio.load(html);
    // Recoger todos los links a evento.php?id=XXX
    $('a[href*="evento.php?id="]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href || seen.has(href)) return;
      seen.add(href);
      const eventUrl = href.startsWith('http') ? href : `${BASE}/${href.replace(/^\//, '')}`;
      // Título: texto del link o del h4/h5 cercano
      const anchor = $(el);
      const title = anchor.find('h4,h5').first().text().trim() || anchor.text().trim();
      // Fecha visible en el listado
      const dateText = anchor.find('h4').last().text().trim() || '';
      if (title && !title.match(/adquirir|entrada/i)) {
        basicEvents.push({ title, dateText, eventUrl });
      }
    });
  } catch (err) { console.error('[Smarticket] Error listado:', err.message); return []; }

  // Deduplicar por título
  const unique = [];
  const titleseen = new Set();
  for (const ev of basicEvents) {
    if (!ev.title || titleseen.has(ev.title)) continue;
    titleseen.add(ev.title);
    unique.push(ev);
  }

  const events = [];
  for (const ev of unique) {
    const detail = await fetchSmarticketDetail(ev.eventUrl);
    const title       = (detail.title && detail.title.length > 3) ? detail.title : ev.title;
    const dateText    = detail.dateText    || ev.dateText;
    const locationText = detail.locationText || 'Costa Rica';
    const imageUrl    = detail.imageUrl    || '';
    events.push({
      title,
      imageUrl,
      dateText,
      locationText,
      description: '', // Smarticket no tiene descripción en sus páginas
      eventUrl: ev.eventUrl,
      dateISO: parseDateToISO(dateText),
      source: 'Smarticket',
      coords: resolveCoords(locationText),
    });
    await sleep(400);
  }
  console.log(`[Smarticket] ${events.length} eventos.`);
  return events;
}

// ─── 4. Eticket.cr ────────────────────────────────────────────────────────────
// Se hace en 2 partes:
//   1) home.aspx → cards .listado_artistas con título, imagen, lugar y link al artista
//   2) eventos.aspx?idartista=XXX → fecha (no se extrae descripción)
async function fetchEticketArtistDate(artistUrl) {
  try {
    const html = await fetchHTML(artistUrl);
    const $    = cheerio.load(html);
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    const slashDate = text.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
    if (slashDate) return slashDate[0];
    const longDate = text.match(/(\d{1,2})\s+de\s+\w+\s+de\s+(\d{4})/i);
    if (longDate) return longDate[0];
    return '';
  } catch { return ''; }
}

async function scrapeEticket() {
  const BASE = 'https://www.eticket.cr';
  console.log('[Eticket.cr] Iniciando...');
  const basicEvents = [];
  const seenUrls    = new Set();

  try {
    const html = await fetchHTML(`${BASE}/home.aspx`);
    const $    = cheerio.load(html);

    // Cada card de evento usa la clase listado_artistas
    $('div.listado_artistas').each((_, el) => {
      try {
        const card    = $(el);
        const anchor  = card.find('a[href*="idartista="]').first();
        const href    = anchor.attr('href') || '';
        if (!href) return;
        const artistUrl = href.startsWith('http')
          ? href
          : `${BASE}/${href.replace(/^\.\.\//, '').replace(/^\//, '')}`;
        if (seenUrls.has(artistUrl)) return;
        seenUrls.add(artistUrl);

        const title = card.find('div.line-clamp-3.grisoscuro').first().text().trim()
          || card.find('div.line-clamp-3').first().text().trim();
        if (!title) return;

        const imgEl    = card.find('img').first();
        const imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || '';

        const locationText = card.find('div.line-clamp-1.grisoscuro').first().text().trim()
          || card.find('div.line-clamp-1').first().text().trim()
          || 'Costa Rica';

        basicEvents.push({ title, imageUrl, locationText, artistUrl });
      } catch {}
    });
  } catch (err) { console.error('[Eticket.cr] Error listado:', err.message); return []; }

  console.log(`[Eticket.cr] ${basicEvents.length} eventos en listado. Obteniendo fechas...`);

  const events = [];
  for (const ev of basicEvents) {
    const dateText = await fetchEticketArtistDate(ev.artistUrl);
    events.push({
      title:        ev.title,
      imageUrl:     ev.imageUrl,
      dateText,
      locationText: ev.locationText,
      description:  '',
      eventUrl:     ev.artistUrl,
      dateISO:      parseDateToISO(dateText),
      source:       'Eticket',
      coords:       resolveCoords(ev.locationText),
    });
    await sleep(300);
  }

  console.log(`[Eticket.cr] ${events.length} eventos completos.`);
  return events;
}

// ─── 5. SpecialTicket ─────────────────────────────────────────────────────────
// Sitio renderizado con JavaScript — requiere Puppeteer
async function scrapeSpecialTicket() {
  console.log('[SpecialTicket] Iniciando (Puppeteer)...');
  let puppeteer;
  try { puppeteer = require('puppeteer'); }
  catch { console.warn('[SpecialTicket] Puppeteer no instalado. Ejecutá: npm install puppeteer'); return []; }

  const BASE = 'https://specialticket.net';
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36');
  const events = [];

  try {
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('a, .event, article, .card', { timeout: 10000 }).catch(() => {});

    const raw = await page.evaluate(() => {
      const results = [];
      // Buscar cards de eventos: anchors con href de evento
      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href') || '';
        if (!href.includes('event') && !href.includes('evento') && !href.includes('ticket')) return;
        const img   = a.querySelector('img');
        const title = (a.querySelector('h1,h2,h3,h4,h5,strong,b')?.textContent || a.textContent || '').trim();
        if (!title || title.length < 4) return;
        results.push({
          title,
          eventUrl: href.startsWith('http') ? href : location.origin + href,
          imageUrl: img?.src || img?.dataset?.src || '',
          dateText: '',
          locationText: '',
        });
      });
      return results;
    });

    for (const ev of raw.slice(0, 30)) {
      try {
        await page.goto(ev.eventUrl, { waitUntil: 'networkidle2', timeout: 20000 });
        const detail = await page.evaluate(() => {
          const body = document.body.innerText;
          const dateMatch    = body.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/);
          const locationMatch = body.match(/(?:lugar|venue|ubicaci[oó]n)[:\s]+([^\n]+)/i);
          const descEl = document.querySelector('p, .description, .desc, article');
          return {
            dateText:    dateMatch ? dateMatch[0] : '',
            locationText: locationMatch ? locationMatch[1].trim() : 'Costa Rica',
            description: descEl?.textContent?.trim()?.slice(0, 400) || '',
            imageUrl:    document.querySelector('meta[property="og:image"]')?.content
                      || document.querySelector('img.event-img, img.main, .hero img')?.src || '',
          };
        });
        events.push({
          ...ev,
          ...detail,
          dateISO: parseDateToISO(detail.dateText),
          source:  'SpecialTicket',
          coords:  resolveCoords(detail.locationText),
        });
        await sleep(500);
      } catch {}
    }
  } catch (err) {
    console.error('[SpecialTicket] Error:', err.message);
  } finally {
    await browser.close();
  }
  console.log(`[SpecialTicket] ${events.length} eventos.`);
  return events;
}

// ─── 6. TiqueteBox ────────────────────────────────────────────────────────────
// Angular SPA — requiere Puppeteer
async function scrapeTiqueteBox() {
  console.log('[TiqueteBox] Iniciando (Puppeteer)...');
  let puppeteer;
  try { puppeteer = require('puppeteer'); }
  catch { console.warn('[TiqueteBox] Puppeteer no instalado. Ejecutá: npm install puppeteer'); return []; }

  const BASE = 'https://www.tiquetebox.app';
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36');
  const events = [];

  try {
    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle2', timeout: 40000 });
    // Esperar a que Angular renderice las tarjetas
    await page.waitForSelector('app-event-card, .event-card, mat-card, .card, article', { timeout: 15000 }).catch(() => {});
    await sleep(2000);

    const raw = await page.evaluate(() => {
      const results = [];
      const selectors = ['app-event-card', '.event-card', 'mat-card', '.card', 'article', 'li'];
      let found = [];
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        if (els.length > 2) { found = Array.from(els); break; }
      }
      found.forEach(card => {
        const title = (card.querySelector('h1,h2,h3,h4,mat-card-title,.title,.event-title')?.textContent || '').trim();
        if (!title || title.length < 4) return;
        const linkEl = card.querySelector('a[href]') || card.closest('a[href]');
        const href   = linkEl?.getAttribute('href') || '';
        const img    = card.querySelector('img');
        const dateEl = card.querySelector('.date, .fecha, time, [class*="date"], [class*="fecha"]');
        const locEl  = card.querySelector('.location, .lugar, .venue, [class*="location"], [class*="lugar"]');
        results.push({
          title,
          eventUrl: href ? (href.startsWith('http') ? href : location.origin + href) : location.href,
          imageUrl:     img?.src || img?.dataset?.src || '',
          dateText:     dateEl?.textContent?.trim() || '',
          locationText: locEl?.textContent?.trim()  || 'Costa Rica',
        });
      });
      return results;
    });

    for (const ev of raw.slice(0, 30)) {
      const detail = { description: '' };
      if (ev.eventUrl && ev.eventUrl !== `${BASE}/home`) {
        try {
          await page.goto(ev.eventUrl, { waitUntil: 'networkidle2', timeout: 20000 });
          await sleep(1500);
          detail.description = await page.evaluate(() =>
            (document.querySelector('p, .description, app-event-description')?.textContent || '').trim().slice(0, 400)
          );
        } catch {}
      }
      events.push({
        ...ev,
        ...detail,
        dateISO: parseDateToISO(ev.dateText),
        source:  'TiqueteBox',
        coords:  resolveCoords(ev.locationText),
      });
    }
  } catch (err) {
    console.error('[TiqueteBox] Error:', err.message);
  } finally {
    await browser.close();
  }
  console.log(`[TiqueteBox] ${events.length} eventos.`);
  return events;
}

// ─── 7. StarTicket ────────────────────────────────────────────────────────────
// Retorna 403 a bots simples — intentamos con headers completos, si falla usamos Puppeteer
async function scrapeStarTicket() {
  const BASE = 'https://starticket.cr';
  console.log('[StarTicket] Iniciando...');

  // Intento 1: axios con headers de navegador real
  try {
    const html = await fetchHTML(`${BASE}/en`, {
      'Referer': 'https://www.google.com/',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site',
    });
    const $ = cheerio.load(html);
    const events = [];
    const seenUrls = new Set();

    // Intentar selectores comunes de eventos
    const cardSelectors = ['article', '.event-card', '.event-item', '.event', 'li.event', '.card'];
    let cards = $();
    for (const sel of cardSelectors) {
      if ($(sel).length > 1) { cards = $(sel); break; }
    }

    if (cards.length === 0) {
      // Fallback: buscar todos los links con /event o /evento en el href
      $('a[href*="/event"]').each((_, el) => {
        const anchor = $(el);
        const href   = anchor.attr('href') || '';
        const url    = href.startsWith('http') ? href : `${BASE}${href}`;
        if (seenUrls.has(url)) return;
        seenUrls.add(url);
        const title = anchor.find('h1,h2,h3,h4,h5').first().text().trim() || anchor.text().trim();
        if (!title || title.length < 4) return;
        const img = anchor.find('img').first().attr('src') || '';
        events.push({ title, imageUrl: img, dateText: '', locationText: 'Costa Rica', description: '', eventUrl: url,
          dateISO: null, source: 'StarTicket', coords: PROVINCE_COORDS['San José'] });
      });
    } else {
      cards.each((_, el) => {
        const card = $(el);
        const title = card.find('h1,h2,h3,h4,h5').first().text().trim();
        if (!title) return;
        const linkEl = card.find('a[href]').first();
        const href   = linkEl.attr('href') || '';
        const url    = href.startsWith('http') ? href : `${BASE}${href}`;
        if (seenUrls.has(url)) return;
        seenUrls.add(url);
        const img   = card.find('img').first().attr('src') || card.find('img').first().attr('data-src') || '';
        const date  = card.find('[class*="date"], time, .date').first().text().trim();
        const loc   = card.find('[class*="location"], [class*="venue"], .location').first().text().trim() || 'Costa Rica';
        events.push({ title, imageUrl: img, dateText: date, locationText: loc, description: '',
          eventUrl: url, dateISO: parseDateToISO(date), source: 'StarTicket', coords: resolveCoords(loc) });
      });
    }

    if (events.length > 0) {
      console.log(`[StarTicket] ${events.length} eventos (axios).`);
      return events;
    }
    // Si no encontró nada con axios, cae a Puppeteer
    throw new Error('Sin resultados con axios');
  } catch (axiosErr) {
    console.warn(`[StarTicket] axios falló (${axiosErr.message}), intentando con Puppeteer...`);
  }

  // Intento 2: Puppeteer
  let puppeteer;
  try { puppeteer = require('puppeteer'); }
  catch { console.warn('[StarTicket] Puppeteer no instalado. Ejecutá: npm install puppeteer'); return []; }

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36');
  const events = [];

  try {
    await page.goto(`${BASE}/en`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);

    const raw = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href') || '';
        if (!href.includes('/event') && !href.includes('/show') && !href.includes('/ticket')) return;
        const title = (a.querySelector('h1,h2,h3,h4,h5')?.textContent || a.textContent || '').trim();
        if (!title || title.length < 4) return;
        const img = a.querySelector('img');
        results.push({
          title,
          eventUrl: href.startsWith('http') ? href : location.origin + href,
          imageUrl: img?.src || '',
          dateText: a.querySelector('[class*="date"], time')?.textContent?.trim() || '',
          locationText: a.querySelector('[class*="location"], [class*="venue"]')?.textContent?.trim() || 'Costa Rica',
        });
      });
      return results;
    });

    for (const ev of raw.slice(0, 30)) {
      events.push({ ...ev, description: '', dateISO: parseDateToISO(ev.dateText),
        source: 'StarTicket', coords: resolveCoords(ev.locationText) });
    }
  } catch (err) {
    console.error('[StarTicket] Puppeteer error:', err.message);
  } finally {
    await browser.close();
  }
  console.log(`[StarTicket] ${events.length} eventos (Puppeteer).`);
  return events;
}

// ─── Guardar en Firestore ─────────────────────────────────────────────────────
async function saveEvents(events) {
  if (!events.length) { console.log('Sin eventos para guardar.'); return; }
  const batch = db.batch();
  let count = 0;
  for (const event of events) {
    if (!event.eventUrl || !event.title) continue;
    const docId = toBase64Id(event.eventUrl);
    const ref   = db.collection('eventos_externos').doc(docId);
    batch.set(ref, {
      title:        event.title,
      imageUrl:     event.imageUrl     || '',
      dateText:     event.dateText     || '',
      dateISO:      event.dateISO      || null,
      locationText: event.locationText || '',
      description:  event.description  || '',
      eventUrl:     event.eventUrl,
      source:       event.source,
      geopunto:     new GeoPoint(event.coords.lat, event.coords.lng),
      updatedAt:    Timestamp.now(),
    }, { merge: true });
    count++;
    if (count % 499 === 0) { await batch.commit(); console.log(`Guardados ${count}...`); }
  }
  await batch.commit();
  console.log(`✓ Total guardado: ${count} eventos en eventos_externos.`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const SCRAPERS = {
  gam:          { fn: scrapeGAMCultural, puppeteer: false },
  eventcr:      { fn: scrapeEventCR,    puppeteer: false },
  smarticket:   { fn: scrapeSmarticket, puppeteer: false },
  eticket:      { fn: scrapeEticket,    puppeteer: false },
  specialticket:{ fn: scrapeSpecialTicket, puppeteer: true },
  tiquetebox:   { fn: scrapeTiqueteBox,    puppeteer: true },
  starticket:   { fn: scrapeStarTicket,    puppeteer: true },
};

async function main() {
  const toRun = Object.entries(SCRAPERS).filter(([name, cfg]) => {
    if (onlyArg && name !== onlyArg) return false;
    if (skipPuppeteer && cfg.puppeteer) { console.log(`[${name}] Omitido (--skip=puppeteer)`); return false; }
    return true;
  });

  console.log(`\nEjecutando ${toRun.length} scrapers...\n`);
  const results = await Promise.allSettled(toRun.map(([, cfg]) => cfg.fn()));
  const all = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  console.log(`\nTotal extraído: ${all.length} eventos.`);
  await saveEvents(all);
}

main().catch(err => { console.error('Error fatal:', err); process.exit(1); });

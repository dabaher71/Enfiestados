const { setGlobalOptions } = require("firebase-functions");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const axios = require("axios");
const cheerio = require("cheerio");

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ maxInstances: 10, region: "us-central1" });

// ─── Scoring helpers (misma lógica que feedService.js en el cliente) ──────────

const WEIGHTS = { affinity: 0.40, popularity: 0.25, recency: 0.25, social: 0.10 };

function categoryAffinityScore(event, interestVector) {
  if (!event.category || !interestVector) return 0;
  return interestVector[event.category.toLowerCase()] || 0;
}

function popularityScore(event) {
  const count = (event.likes?.length || 0) + (event.attendees?.length || 0);
  return Math.min(1, Math.log10(count + 1) / 2);
}

function recencyScore(event) {
  try {
    let ts;
    const parts = event.date?.split("/");
    if (parts?.length === 3) {
      ts = new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime();
    }
    if (!ts) return 0;
    const daysUntil = (ts - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntil < 0) return 0;
    if (daysUntil <= 3) return 1.0;
    if (daysUntil <= 7) return 0.85;
    if (daysUntil <= 14) return 0.65;
    if (daysUntil <= 30) return 0.45;
    if (daysUntil <= 90) return 0.25;
    return 0.1;
  } catch {
    return 0;
  }
}

function scoreEvents(events, interestVector, hiddenIds, followingIds, attendeesMap) {
  return events
    .filter((ev) => !hiddenIds.has(ev.id))
    .map((ev) => {
      // Señal social: qué porcentaje de tus seguidos asiste a este evento
      const attendees = ev.attendees || [];
      const socialCount = followingIds.size > 0
        ? attendees.filter((uid) => followingIds.has(uid)).length / followingIds.size
        : 0;

      const score =
        WEIGHTS.affinity * categoryAffinityScore(ev, interestVector) +
        WEIGHTS.popularity * popularityScore(ev) +
        WEIGHTS.recency * recencyScore(ev) +
        WEIGHTS.social * Math.min(1, socialCount * 5); // amplificar señal social débil

      return { id: ev.id, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 200) // máximo 200 eventos pre-computados por usuario
    .map((ev) => ev.id);
}

// ─── Función principal: genera feeds para todos los usuarios activos ──────────
// Corre cada 30 minutos. Solo procesa usuarios activos en los últimos 7 días.

exports.computePersonalizedFeeds = onSchedule(
  { schedule: "every 30 minutes", timeoutSeconds: 540 },
  async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Obtener usuarios activos recientemente
    const usersSnap = await db.collection("users")
      .where("lastActive", ">", admin.firestore.Timestamp.fromDate(sevenDaysAgo))
      .select("interestVector", "following")
      .get();

    if (usersSnap.empty) return;

    // Cargar todos los eventos una sola vez (compartido entre usuarios)
    const eventsSnap = await db.collection("events").limit(5000).get();
    const allEvents = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Procesar usuarios en lotes de 20 para no saturar Firestore
    const users = usersSnap.docs;
    const BATCH_SIZE = 20;

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = users.slice(i, i + BATCH_SIZE);

      await Promise.all(
        chunk.map(async (userDoc) => {
          const userId = userDoc.id;
          const userData = userDoc.data();
          const interestVector = userData.interestVector || {};
          const followingIds = new Set(userData.following || []);

          // Obtener eventos ocultos por este usuario
          const hiddenSnap = await db
            .collection("userSignals")
            .doc(userId)
            .collection("interactions")
            .where("hidden", "==", true)
            .get();
          const hiddenIds = new Set(hiddenSnap.docs.map((d) => d.id));

          const rankedIds = scoreEvents(allEvents, interestVector, hiddenIds, followingIds);

          const feedRef = db.collection("feeds").doc(userId);
          batch.set(feedRef, {
            eventIds: rankedIds,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        })
      );

      await batch.commit();
    }
  }
);

// ─── Función callable: forzar regeneración del feed de un usuario ─────────────
// La app puede llamarla cuando el usuario hace pull-to-refresh.

const REFRESH_COOLDOWN_MS = 60 * 1000;

exports.refreshMyFeed = onCall(
  { timeoutSeconds: 30 },
  async (request) => {
    const userId = request.auth?.uid;
    if (!userId) throw new HttpsError("unauthenticated", "Debes estar autenticado");

    // Cooldown: evita que un script llame esta función en loop (cada corrida
    // lee hasta 5000 eventos) para inflar el costo de Firestore/Functions.
    const feedRef = db.collection("feeds").doc(userId);
    const existingFeed = await feedRef.get();
    const lastUpdatedAt = existingFeed.exists ? existingFeed.data().updatedAt : null;
    if (lastUpdatedAt) {
      const msSinceLastRefresh = Date.now() - lastUpdatedAt.toMillis();
      if (msSinceLastRefresh < REFRESH_COOLDOWN_MS) {
        const waitSeconds = Math.ceil((REFRESH_COOLDOWN_MS - msSinceLastRefresh) / 1000);
        throw new HttpsError("resource-exhausted", `Esperá ${waitSeconds}s antes de refrescar de nuevo`);
      }
    }

    const [userDoc, eventsSnap, hiddenSnap] = await Promise.all([
      db.collection("users").doc(userId).get(),
      db.collection("events").limit(5000).get(),
      db.collection("userSignals").doc(userId).collection("interactions")
        .where("hidden", "==", true).get(),
    ]);

    const userData = userDoc.exists ? userDoc.data() : {};
    const interestVector = userData.interestVector || {};
    const followingIds = new Set(userData.following || []);
    const hiddenIds = new Set(hiddenSnap.docs.map((d) => d.id));
    const allEvents = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const rankedIds = scoreEvents(allEvents, interestVector, hiddenIds, followingIds);

    await feedRef.set({
      eventIds: rankedIds,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { count: rankedIds.length };
  }
);

// ─── Auto-ocultar contenido con 5+ reportes ───────────────────────────────────
// Se dispara cada vez que se crea un nuevo reporte.

exports.onReportCreated = onDocumentCreated("reports/{reportId}", async (event) => {
  const report = event.data?.data();
  if (!report) return;

  const { targetId, targetType } = report;

  // Contar reportes pendientes para este contenido
  const reportsSnap = await db.collection("reports")
    .where("targetId", "==", targetId)
    .where("status", "==", "pending")
    .get();

  if (reportsSnap.size < 5) return;

  // Ocultar el contenido automáticamente hasta revisión admin
  const collectionMap = { event: "events", post: "posts", user: "users" };
  const col = collectionMap[targetType];
  if (!col) return;

  await db.collection(col).doc(targetId).update({
    hidden: true,
    hiddenReason: "auto_reports",
    hiddenAt: admin.firestore.FieldValue.serverTimestamp(),
  });
});

// ─── Procesar acción admin sobre un reporte ───────────────────────────────────
// Acciones: dismiss | warn | delete_content | ban
// Solo usuarios con isAdmin: true en Firestore pueden llamar esta función.

exports.processReportAction = onCall(
  { timeoutSeconds: 30 },
  async (request) => {
    const adminId = request.auth?.uid;
    if (!adminId) throw new HttpsError("unauthenticated", "Debes estar autenticado");

    // Verificar que el caller es admin
    const adminDoc = await db.collection("users").doc(adminId).get();
    if (!adminDoc.exists || adminDoc.data().isAdmin !== true) {
      throw new HttpsError("permission-denied", "No tienes permisos de administrador");
    }

    const { reportId, action, reason } = request.data;
    if (reason !== undefined && (typeof reason !== 'string' || reason.length > 500)) {
      throw new HttpsError("invalid-argument", "reason debe ser texto de máximo 500 caracteres");
    }
    if (!reportId || !action) {
      throw new HttpsError("invalid-argument", "reportId y action son requeridos");
    }

    const reportRef = db.collection("reports").doc(reportId);
    const reportSnap = await reportRef.get();
    if (!reportSnap.exists) throw new HttpsError("not-found", "Reporte no encontrado");

    const report = reportSnap.data();
    const { targetId, targetType, reporterId } = report;
    const collectionMap = { event: "events", post: "posts", user: "users" };

    const batch = db.batch();

    if (action === "dismiss") {
      // Desestimar: marcar reporte y restaurar visibilidad si aplica
      batch.update(reportRef, {
        status: "dismissed",
        reviewedBy: adminId,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const col = collectionMap[targetType];
      if (col) {
        batch.update(db.collection(col).doc(targetId), {
          hidden: false,
          hiddenReason: admin.firestore.FieldValue.delete(),
          hiddenAt: admin.firestore.FieldValue.delete(),
        });
      }

    } else if (action === "warn") {
      // Advertir: marcar reporte + notificar al dueño del contenido
      batch.update(reportRef, {
        status: "actioned",
        actionTaken: "warn",
        reviewedBy: adminId,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      // Obtener el dueño del contenido para notificarle
      const col = collectionMap[targetType];
      if (col) {
        const contentSnap = await db.collection(col).doc(targetId).get();
        const ownerId = contentSnap.data()?.organizerId || contentSnap.data()?.userId || targetId;
        if (ownerId && ownerId !== adminId) {
          batch.set(db.collection("notifications").doc(), {
            toUserId: ownerId,
            type: "admin_warning",
            message: reason || "Tu contenido ha sido revisado y recibió una advertencia por parte del equipo de moderación.",
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

    } else if (action === "delete_content") {
      // Eliminar contenido + marcar reporte
      batch.update(reportRef, {
        status: "actioned",
        actionTaken: "delete_content",
        reviewedBy: adminId,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const col = collectionMap[targetType];
      if (col && targetType !== "user") {
        batch.delete(db.collection(col).doc(targetId));
      }

    } else if (action === "ban") {
      // Banear usuario: deshabilitar auth + marcar en Firestore + notificar
      if (targetType !== "user") {
        throw new HttpsError("invalid-argument", "ban solo aplica a usuarios");
      }
      await admin.auth().updateUser(targetId, { disabled: true });
      batch.update(db.collection("users").doc(targetId), {
        banned: true,
        bannedAt: admin.firestore.FieldValue.serverTimestamp(),
        bannedReason: reason || "Violación de términos de servicio",
      });
      batch.update(reportRef, {
        status: "actioned",
        actionTaken: "ban",
        reviewedBy: adminId,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    } else {
      throw new HttpsError("invalid-argument", `Acción desconocida: ${action}`);
    }

    await batch.commit();
    return { success: true, action };
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// SCRAPING DE EVENTOS EXTERNOS
// Corre diariamente a las 2am hora Costa Rica (8am UTC).
// Fuentes: GAM Cultural, EventCR, Smarticket, Eticket.cr
// (SpecialTicket / TiqueteBox / StarTicket requieren Puppeteer → script local)
// ═══════════════════════════════════════════════════════════════════════════════

const PROVINCE_COORDS = {
  "San José":   { lat: 9.9333,  lng: -84.0833 },
  "Alajuela":   { lat: 10.0167, lng: -84.2167 },
  "Cartago":    { lat: 9.8667,  lng: -83.9167 },
  "Heredia":    { lat: 10.0000, lng: -84.1167 },
  "Guanacaste": { lat: 10.3167, lng: -85.6167 },
  "Puntarenas": { lat: 9.9758,  lng: -84.8312 },
  "Limón":      { lat: 9.9833,  lng: -83.0333 },
};

const LOCATION_MAP = [
  { keywords: ["San José","Escazú","Desamparados","Goicoechea","Santa Ana","Tibás","Moravia",
               "Montes de Oca","Curridabat","Teatro Nacional","Teatro Melico","Auditorio Nacional",
               "Parque La Sabana","Sabana","Paseo Colón","Barrio Amón","Barrio Escalante",
               "San Jose","SAN JOSE","SAN JOSÉ","CENAC","Centro Nacional de la Cultura"],
    province: "San José" },
  { keywords: ["Alajuela","San Ramón","Grecia","Atenas","Naranjo","Palmares","San Carlos",
               "La Fortuna","Ciudad Quesada","ALAJUELA"],
    province: "Alajuela" },
  { keywords: ["Cartago","Paraíso","La Unión","Turrialba","Tres Ríos","CARTAGO"],
    province: "Cartago" },
  { keywords: ["Heredia","Barva","Santo Domingo","Santa Bárbara","San Pablo","HEREDIA"],
    province: "Heredia" },
  { keywords: ["Guanacaste","Liberia","Nicoya","Santa Cruz","Tamarindo","Nosara","GUANACASTE"],
    province: "Guanacaste" },
  { keywords: ["Puntarenas","Quepos","Jacó","Manuel Antonio","Dominical","Golfito","PUNTARENAS"],
    province: "Puntarenas" },
  { keywords: ["Limón","Pococí","Siquirres","Cahuita","Puerto Viejo","LIMÓN","LIMON"],
    province: "Limón" },
];

const MONTH_ES = {
  ENE:0,FEB:1,MAR:2,ABR:3,MAY:4,JUN:5,JUL:6,AGO:7,SEP:8,OCT:9,NOV:10,DIC:11,
  Ene:0,Feb:1,Mar:2,Abr:3,May:4,Jun:5,Jul:6,Ago:7,Sep:8,Oct:9,Nov:10,Dic:11,
  ENERO:0,FEBRERO:1,MARZO:2,ABRIL:3,MAYO:4,JUNIO:5,JULIO:6,AGOSTO:7,
  SEPTIEMBRE:8,SETIEMBRE:8,OCTUBRE:9,NOVIEMBRE:10,DICIEMBRE:11,
};

function scrapeResolveCoords(text = "") {
  const t = text.toLowerCase();
  for (const e of LOCATION_MAP) {
    if (e.keywords.some((k) => t.includes(k.toLowerCase()))) {
      return PROVINCE_COORDS[e.province];
    }
  }
  return PROVINCE_COORDS["San José"];
}

function scrapeParseDateToISO(dateText) {
  if (!dateText) return null;
  const slashMatch = dateText.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slashMatch) {
    let [, d, m, y] = slashMatch;
    if (y.length === 2) y = "20" + y;
    return new Date(+y, +m - 1, +d).toISOString();
  }
  const longMatch = dateText.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
  if (longMatch) {
    const [, d, mesStr, y] = longMatch;
    const key = mesStr.slice(0, 3).toUpperCase();
    if (MONTH_ES[key] !== undefined) return new Date(+y, MONTH_ES[key], +d).toISOString();
  }
  const tokens = dateText.replace(/\./g, "").split(/[\s,/-]+/);
  let day = null, monthIdx = null;
  for (const t of tokens) {
    if (/^\d{1,2}$/.test(t) && day === null) day = parseInt(t, 10);
    const key = t.slice(0, 3).toUpperCase();
    if (MONTH_ES[key] !== undefined) monthIdx = MONTH_ES[key];
  }
  if (day !== null && monthIdx !== null) {
    const now = new Date();
    let year = now.getFullYear();
    const candidate = new Date(year, monthIdx, day);
    if (candidate < now && now - candidate > 7 * 86400000) year++;
    return new Date(year, monthIdx, day).toISOString();
  }
  return null;
}

function toBase64Id(url) {
  return Buffer.from(url).toString("base64").replace(/[/=+]/g, "_");
}

async function fetchHTML(url) {
  const { data, headers } = await axios.get(url, {
    timeout: 20000,
    responseType: "arraybuffer",
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-CR,es;q=0.9,en;q=0.8",
    },
  });
  const ct = (headers["content-type"] || "").toLowerCase();
  const charset = ct.match(/charset=([\w-]+)/)?.[1] || "utf-8";
  const isLatin = /iso-8859|windows-1252|latin/.test(charset);
  return Buffer.from(data).toString(isLatin ? "latin1" : "utf8");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── GAM Cultural ──────────────────────────────────────────────────────────────
async function scrapeGAMCulturalFn() {
  const BASE = "https://www.gamcultural.com";
  const basicEvents = [];
  try {
    const html = await fetchHTML(`${BASE}/cr/home`);
    const $ = cheerio.load(html);
    $("li.viral-item.viral-event").each((_, el) => {
      try {
        const card = $(el);
        const title = card.find(".viral-event-title a.viral-linked span").first().text().trim()
          || card.find(".viral-event-title a").first().text().trim();
        if (!title) return;
        const relHref = card.find(".viral-event-title a.viral-linked").first().attr("href") || "";
        const eventUrl = relHref.startsWith("http") ? relHref : `${BASE}${relHref}`;
        const imageUrl = card.find(".viral-event-image").first().attr("data-img") || "";
        const weekday  = card.find(".viral-event-weekday").first().text().trim();
        const day      = card.find(".viral-event-day").first().text().trim();
        const month    = card.find(".viral-event-month").first().text().trim();
        const dateText = [weekday, day, month].filter(Boolean).join(" ");
        const venueText = card.find(".viral-event-place").first().text().trim();
        const nodeText  = card.find(".node-name").first().text().trim();
        const locationText = [venueText, nodeText].filter(Boolean).join(", ");
        basicEvents.push({ title, imageUrl, dateText, locationText, eventUrl });
      } catch {}
    });
  } catch (err) {
    console.error("[GAM Cultural] Error listado:", err.message);
    return [];
  }

  const events = [];
  for (const ev of basicEvents) {
    let description = "";
    try {
      const html = await fetchHTML(ev.eventUrl);
      const $ = cheerio.load(html);
      const sc = $("#viral-single-content script[type=\"application/ld+json\"]").html();
      if (sc) description = JSON.parse(sc.trim()).description || "";
    } catch {}
    events.push({
      ...ev, description,
      dateISO: scrapeParseDateToISO(ev.dateText),
      source:  "GAM Cultural",
      coords:  scrapeResolveCoords(ev.locationText || ev.title),
    });
    await sleep(300);
  }
  console.log(`[GAM Cultural] ${events.length} eventos.`);
  return events;
}

// ── EventCR ───────────────────────────────────────────────────────────────────
async function scrapeEventCRFn() {
  const BASE = "https://eventcr.com";
  const basicEvents = [];
  try {
    const html = await fetchHTML(BASE);
    const $ = cheerio.load(html);
    $("a.event-link").each((_, el) => {
      try {
        const anchor = $(el);
        const title = anchor.find("h3.event-title").first().text().trim();
        if (!title) return;
        const relHref = anchor.attr("href") || "";
        const eventUrl = relHref.startsWith("http") ? relHref : `${BASE}/${relHref.replace(/^\//, "")}`;
        const imageUrl = anchor.find("img.event-img").first().attr("src") || "";
        const dateText = (anchor.find(".meta-date").first().html() || anchor.find(".meta-line").first().html() || "")
          .replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        const locationText = anchor.find("p.event-venue").first().text().trim();
        basicEvents.push({ title, imageUrl, dateText, locationText, eventUrl });
      } catch {}
    });
  } catch (err) { console.error("[EventCR] Error:", err.message); return []; }

  const events = [];
  for (const ev of basicEvents) {
    let description = "";
    try {
      const html = await fetchHTML(ev.eventUrl);
      const $ = cheerio.load(html);
      description = $(".seat-info").find("p").map((_, el) => $(el).text().trim()).get().filter(Boolean).join(" ");
    } catch {}
    events.push({
      ...ev, description,
      dateISO: scrapeParseDateToISO(ev.dateText),
      source:  "EventCR",
      coords:  scrapeResolveCoords(ev.locationText),
    });
    await sleep(300);
  }
  console.log(`[EventCR] ${events.length} eventos.`);
  return events;
}

// ── Smarticket ────────────────────────────────────────────────────────────────
async function scrapeSmartickétFn() {
  const BASE = "https://smarticket.net";
  const seen = new Set();
  const basicEvents = [];
  try {
    const html = await fetchHTML(BASE);
    const $ = cheerio.load(html);
    $("a[href*=\"evento.php?id=\"]").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (!href || seen.has(href)) return;
      seen.add(href);
      const eventUrl = href.startsWith("http") ? href : `${BASE}/${href.replace(/^\//, "")}`;
      const anchor = $(el);
      const title = anchor.find("h4,h5").first().text().trim() || anchor.text().trim();
      const dateText = anchor.find("h4").last().text().trim() || "";
      if (title && !title.match(/adquirir|entrada/i)) {
        basicEvents.push({ title, dateText, eventUrl });
      }
    });
  } catch (err) { console.error("[Smarticket] Error:", err.message); return []; }

  const titleSeen = new Set();
  const events = [];
  for (const ev of basicEvents) {
    if (!ev.title || titleSeen.has(ev.title)) continue;
    titleSeen.add(ev.title);
    let title = ev.title, dateText = ev.dateText, locationText = "Costa Rica", imageUrl = "";
    try {
      const html = await fetchHTML(ev.eventUrl);
      const $ = cheerio.load(html);
      // Título en <strong> (sin números de fecha) o en <h3>
      $("strong").each((_, el) => {
        const t = $(el).text().trim();
        if (t.length > 3 && !t.match(/^\d/) && !t.match(/adquirir|entrada|sector|lugar/i)) {
          title = t; return false;
        }
      });
      if (!title || title === ev.title) {
        const h3 = $("h3").filter((_, el) => {
          const t = $(el).text().trim();
          return t.length > 3 && !t.match(/haz click|sector|selecciona/i);
        }).first().text().trim();
        if (h3) title = h3;
      }
      const bodyText = $("body").text();
      const dm = bodyText.match(/(\d{2}\/\d{2}\/\d{4})/);
      const tm = bodyText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/);
      if (dm) dateText = tm ? `${dm[1]} ${tm[1]}` : dm[1];
      // Venue en <strong> corto distinto al título
      $("strong, b").each((_, el) => {
        const t = $(el).text().trim();
        if (t.length > 3 && t.length < 80 && t !== title &&
            !t.match(/\d{2}\/\d{2}/) && !t.match(/adquirir|entrada|selecciona|sector|haz click/i)) {
          if (!locationText || locationText === "Costa Rica") locationText = t;
        }
      });
      // Imagen: background: url('...') en style de <section>
      $("[style]").each((_, el) => {
        const style = $(el).attr("style") || "";
        const match = style.match(/url\(['"](https?:\/\/[^'"]+)['"]\)/);
        if (match && !match[1].includes("logo") && !match[1].includes("costarica")) {
          imageUrl = match[1]; return false;
        }
      });
      if (!imageUrl) imageUrl = $("meta[property=\"og:image\"]").attr("content") || "";
    } catch {}
    events.push({
      title, imageUrl, dateText, locationText,
      description: "", // Smarticket no tiene descripción
      eventUrl: ev.eventUrl,
      dateISO: scrapeParseDateToISO(dateText),
      source:  "Smarticket",
      coords:  scrapeResolveCoords(locationText),
    });
    await sleep(400);
  }
  console.log(`[Smarticket] ${events.length} eventos.`);
  return events;
}

// ── Eticket.cr ────────────────────────────────────────────────────────────────
// 2 fases:
//   1) home.aspx → cards .listado_artistas (título, imagen, lugar, link al artista)
//   2) eventos.aspx?idartista=XXX → fecha (sin descripción)
async function fetchEticketArtistDateFn(artistUrl) {
  try {
    const html = await fetchHTML(artistUrl);
    const $    = cheerio.load(html);
    const text = $("body").text().replace(/\s+/g, " ").trim();
    const slashDate = text.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
    if (slashDate) return slashDate[0];
    const longDate = text.match(/(\d{1,2})\s+de\s+\w+\s+de\s+(\d{4})/i);
    if (longDate) return longDate[0];
    return "";
  } catch { return ""; }
}

async function scrapeEticketFn() {
  const BASE     = "https://www.eticket.cr";
  const seenUrls = new Set();
  const basicEvents = [];
  try {
    const html = await fetchHTML(`${BASE}/home.aspx`);
    const $ = cheerio.load(html);
    $("div.listado_artistas").each((_, el) => {
      try {
        const card    = $(el);
        const anchor  = card.find("a[href*=\"idartista=\"]").first();
        const href    = anchor.attr("href") || "";
        if (!href) return;
        const artistUrl = href.startsWith("http")
          ? href
          : `${BASE}/${href.replace(/^\.\.\//, "").replace(/^\//, "")}`;
        if (seenUrls.has(artistUrl)) return;
        seenUrls.add(artistUrl);

        const title = card.find("div.line-clamp-3.grisoscuro").first().text().trim()
          || card.find("div.line-clamp-3").first().text().trim();
        if (!title) return;

        const imgEl    = card.find("img").first();
        const imageUrl = imgEl.attr("src") || imgEl.attr("data-src") || "";

        const locationText = card.find("div.line-clamp-1.grisoscuro").first().text().trim()
          || card.find("div.line-clamp-1").first().text().trim()
          || "Costa Rica";

        basicEvents.push({ title, imageUrl, locationText, artistUrl });
      } catch {}
    });
  } catch (err) { console.error("[Eticket.cr] Error:", err.message); return []; }

  const events = [];
  for (const ev of basicEvents) {
    const dateText = await fetchEticketArtistDateFn(ev.artistUrl);
    events.push({
      title:        ev.title,
      imageUrl:     ev.imageUrl,
      dateText,
      locationText: ev.locationText,
      description:  "",
      eventUrl:     ev.artistUrl,
      dateISO:      scrapeParseDateToISO(dateText),
      source:       "Eticket",
      coords:       scrapeResolveCoords(ev.locationText),
    });
    await sleep(300);
  }
  console.log(`[Eticket.cr] ${events.length} eventos.`);
  return events;
}

// ── OMTicket ──────────────────────────────────────────────────────────────────
// Plataforma Ticketplus: cada página de evento trae JSON-LD @type=Event con
// fecha ISO exacta y geo (lat/lng) reales — no hace falta scrapeParseDateToISO
// ni scrapeResolveCoords para la fecha/coords (solo como respaldo si faltan).
// El listado completo sale de sitemap.xml, más confiable que el home (que solo
// muestra destacados).
function formatOMDateText(iso) {
  try {
    return new Date(iso).toLocaleString("es-CR", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "America/Costa_Rica",
    });
  } catch { return iso || ""; }
}

async function scrapeOMTicketFn() {
  const BASE = "https://www.omticket.com";
  let eventUrls = [];
  try {
    const xml = await fetchHTML(`${BASE}/sitemap.xml`);
    const matches = xml.match(/<loc>(https:\/\/www\.omticket\.com\/events\/[^<]+)<\/loc>/g) || [];
    eventUrls = [...new Set(matches.map((m) => m.replace(/<\/?loc>/g, "")))];
  } catch (err) {
    console.error("[OMTicket] Error sitemap:", err.message);
    return [];
  }

  const events = [];
  for (const eventUrl of eventUrls) {
    try {
      const html = await fetchHTML(eventUrl);
      const $ = cheerio.load(html);
      let data = null;
      $("script[type=\"application/ld+json\"]").each((_, el) => {
        try {
          const parsed = JSON.parse($(el).html());
          if (parsed["@type"] === "Event") { data = parsed; return false; }
        } catch {}
      });
      if (!data || !data.name) continue;

      const lat = parseFloat(data.location?.geo?.latitude);
      const lng = parseFloat(data.location?.geo?.longitude);
      const locationText = data.location?.name || data.location?.address?.addressRegion || "";

      events.push({
        title:        data.name.trim(),
        imageUrl:     data.image || "",
        dateText:     data.startDate ? formatOMDateText(data.startDate) : "",
        dateISO:      data.startDate ? new Date(data.startDate).toISOString() : null,
        locationText,
        description:  data.description || "",
        eventUrl,
        source:       "OMTicket",
        coords: (!isNaN(lat) && !isNaN(lng))
          ? { lat, lng }
          : scrapeResolveCoords(locationText),
      });
    } catch (err) {
      console.error(`[OMTicket] Error detalle ${eventUrl}:`, err.message);
    }
    await sleep(300);
  }
  console.log(`[OMTicket] ${events.length} eventos.`);
  return events;
}

// ── Guardar en Firestore ──────────────────────────────────────────────────────
async function saveScrapedEvents(events) {
  if (!events.length) return;
  const GeoPoint = admin.firestore.GeoPoint;
  const FieldValue = admin.firestore.FieldValue;
  let batch = db.batch();
  let count = 0;

  for (const event of events) {
    if (!event.eventUrl || !event.title) continue;
    const docId = toBase64Id(event.eventUrl);
    const ref   = db.collection("eventos_externos").doc(docId);
    batch.set(ref, {
      title:        event.title,
      imageUrl:     event.imageUrl     || "",
      dateText:     event.dateText     || "",
      dateISO:      event.dateISO      || null,
      locationText: event.locationText || "",
      description:  event.description  || "",
      eventUrl:     event.eventUrl,
      source:       event.source,
      geopunto:     new GeoPoint(event.coords.lat, event.coords.lng),
      updatedAt:    FieldValue.serverTimestamp(),
    }, { merge: true });
    count++;
    if (count % 499 === 0) { await batch.commit(); batch = db.batch(); }
  }
  await batch.commit();
  console.log(`[Scraper] ✓ ${count} eventos guardados en eventos_externos.`);
}

// ── Cloud Function programada ─────────────────────────────────────────────────
exports.scrapeExternalEvents = onSchedule(
  {
    schedule: "0 8 * * *",   // 2am Costa Rica (UTC-6) = 8am UTC
    timeZone: "America/Costa_Rica",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    console.log("[Scraper] Iniciando extracción de eventos externos...");
    const results = await Promise.allSettled([
      scrapeGAMCulturalFn(),
      scrapeEventCRFn(),
      scrapeSmartickétFn(),
      scrapeEticketFn(),
      scrapeOMTicketFn(),
    ]);
    const all = results.flatMap((r) => r.status === "fulfilled" ? r.value : []);
    console.log(`[Scraper] Total extraído: ${all.length} eventos.`);
    await saveScrapedEvents(all);
  }
);

// ── Callable manual: forzar scraping desde el panel admin ────────────────────
exports.triggerScrape = onCall(
  { timeoutSeconds: 540, memory: "512MiB" },
  async (request) => {
    const adminId = request.auth?.uid;
    if (!adminId) throw new HttpsError("unauthenticated", "Debes estar autenticado");
    const adminDoc = await db.collection("users").doc(adminId).get();
    if (!adminDoc.exists || !adminDoc.data().isAdmin) {
      throw new HttpsError("permission-denied", "Solo admins pueden forzar el scraping");
    }
    console.log(`[Scraper] Forzado por admin ${adminId}`);
    const results = await Promise.allSettled([
      scrapeGAMCulturalFn(),
      scrapeEventCRFn(),
      scrapeSmartickétFn(),
      scrapeEticketFn(),
      scrapeOMTicketFn(),
    ]);
    const all = results.flatMap((r) => r.status === "fulfilled" ? r.value : []);
    await saveScrapedEvents(all);
    return { count: all.length };
  }
);

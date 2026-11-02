const { setGlobalOptions } = require("firebase-functions");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const axios = require("axios");
const cheerio = require("cheerio");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

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

function scoreEvents(events, interestVector, hiddenIds, followingIds, userId) {
  return events
    .filter((ev) => !hiddenIds.has(ev.id))
    // Eventos de perfiles privados: solo para el organizador y sus seguidores.
    .filter((ev) => !ev.organizerPrivate || (ev.viewers || []).includes(userId))
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

          const rankedIds = scoreEvents(allEvents, interestVector, hiddenIds, followingIds, userId);

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

    const rankedIds = scoreEvents(allEvents, interestVector, hiddenIds, followingIds, userId);

    await feedRef.set({
      eventIds: rankedIds,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { count: rankedIds.length };
  }
);

// ─── Auto-ocultar contenido con 5+ reportes ───────────────────────────────────
// Se dispara cada vez que se crea un nuevo reporte.

const AUTO_HIDE_DISTINCT_REPORTERS = 5;

exports.onReportCreated = onDocumentCreated("reports/{reportId}", async (event) => {
  const report = event.data?.data();
  if (!report) return;

  const { targetId, targetType } = report;
  if (typeof targetId !== "string" || !targetId) return;

  const collectionMap = { event: "events", post: "posts", user: "users" };
  const col = collectionMap[targetType];
  if (!col) return;

  // Se cuentan PERSONAS distintas, no reportes. El freno contra duplicados de
  // reportService.js es solo del cliente, así que contando documentos una
  // sola cuenta con un cliente modificado podía mandar 5 reportes y ocultar
  // cualquier evento, publicación o perfil.
  const reportsSnap = await db.collection("reports")
    .where("targetId", "==", targetId)
    .where("status", "==", "pending")
    .get();

  const reporters = new Set(
    reportsSnap.docs
      .filter((d) => d.data().targetType === targetType)
      .map((d) => d.data().reporterId)
      .filter(Boolean)
  );
  if (reporters.size < AUTO_HIDE_DISTINCT_REPORTERS) return;

  // Ocultar el contenido automáticamente hasta revisión admin. Si el destino
  // ya no existe (borrado), no hay nada que ocultar.
  const targetRef = db.collection(col).doc(targetId);
  if (!(await targetRef.get()).exists) return;

  await targetRef.update({
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

// La descripción real (con formato) vive en #descripcion .description-content,
// no en el JSON-LD (que trae una versión corta autogenerada). La app muestra
// description en un <Text> plano, así que se convierte el HTML a texto simple.
function htmlDescriptionToText(html) {
  if (!html) return "";
  return html
    .replace(/<img[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

      const richHtml = $("#descripcion .description-content").first().html()
        || $(".description-content").first().html();
      const description = htmlDescriptionToText(richHtml) || data.description || "";

      events.push({
        title:        data.name.trim(),
        imageUrl:     data.image || "",
        dateText:     data.startDate ? formatOMDateText(data.startDate) : "",
        dateISO:      data.startDate ? new Date(data.startDate).toISOString() : null,
        locationText,
        description,
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

// ─── Eliminación de cuenta con código por correo ───────────────────────────────
// Flujo: el cliente pide un código (requestAccountDeletion), lo recibe por
// email, y lo confirma (confirmAccountDeletion) para borrar la cuenta.
// El código se guarda hasheado — nunca en texto plano — y expira a los 15 min.

// Correo hospedado en Hostinger (smtp.hostinger.com), no Gmail/Microsoft —
// el secret es la contraseña normal de la casilla, no un "app password".
const EMAIL_SMTP_PASSWORD = defineSecret("EMAIL_SMTP_PASSWORD");
const DELETION_SENDER_EMAIL = "info@enfiestados.net";
const DELETION_CODE_TTL_MS = 15 * 60 * 1000;
const DELETION_REQUEST_COOLDOWN_MS = 60 * 1000;
const DELETION_MAX_ATTEMPTS = 5;

function hashDeletionCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

exports.requestAccountDeletion = onCall(
  { secrets: [EMAIL_SMTP_PASSWORD], timeoutSeconds: 30 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Debés estar autenticado");

    const userRecord = await admin.auth().getUser(uid);
    const email = userRecord.email;
    if (!email) {
      throw new HttpsError("failed-precondition", "Tu cuenta no tiene un correo asociado");
    }

    const reqRef = db.collection("accountDeletionRequests").doc(uid);
    const existing = await reqRef.get();
    if (existing.exists) {
      const lastSentAt = existing.data().createdAt?.toMillis?.() ?? 0;
      if (Date.now() - lastSentAt < DELETION_REQUEST_COOLDOWN_MS) {
        throw new HttpsError("resource-exhausted", "Esperá un momento antes de pedir otro código");
      }
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await reqRef.set({
      codeHash: hashDeletionCode(code),
      attempts: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + DELETION_CODE_TTL_MS),
    });

    const transporter = nodemailer.createTransport({
      host: "smtp.hostinger.com",
      port: 465,
      secure: true,
      auth: { user: DELETION_SENDER_EMAIL, pass: EMAIL_SMTP_PASSWORD.value() },
    });

    await transporter.sendMail({
      from: `Enfiestados <${DELETION_SENDER_EMAIL}>`,
      to: email,
      subject: "Código para eliminar tu cuenta de Enfiestados",
      text: `Tu código para eliminar tu cuenta de Enfiestados es: ${code}\n\n` +
        "Vence en 15 minutos. Si no pediste esto, ignorá este correo — tu cuenta sigue segura.\n\n" +
        "— Enfiestados",
    });

    return { sent: true };
  }
);

// ─── Borrado completo de los datos de una cuenta ─────────────────────────────
// Antes confirmAccountDeletion solo borraba users/{uid} y la cuenta de Auth:
// quedaban eventos, publicaciones, mensajes, fotos de chat, notificaciones,
// señales, bloqueos y todo Storage. Google Play exige borrado completo y la
// política de privacidad (Ley 8968) va a prometerlo.
//
// Es idempotente: si falla a la mitad, reintentar con el mismo código termina
// el trabajo.

// Carpetas de Storage organizadas por uid (ver storage.rules).
const USER_STORAGE_PREFIXES = ["events", "avatars", "covers", "posts", "ads", "chats"];

const commentAuthorId = (c) => c?.userId || c?.uid || c?.authorId;

async function deleteAllUserData(uid) {
  const { FieldValue } = admin.firestore;
  const writer = db.bulkWriter();

  // BulkWriter no admite dos escrituras al mismo doc, y un mismo doc puede
  // aparecer en varias consultas (p. ej. un mensaje propio dentro de un chat
  // que también se borra). Se acumula todo y se escribe una vez por doc.
  const toDelete = new Map(); // path → ref
  const toUpdate = new Map(); // path → { ref, data }

  const markDelete = (ref) => toDelete.set(ref.path, ref);
  const markUpdate = (ref, data) => {
    const prev = toUpdate.get(ref.path);
    toUpdate.set(ref.path, { ref, data: { ...(prev?.data || {}), ...data } });
  };
  const deleteWhere = async (col, field, op, value) => {
    const snap = await db.collection(col).where(field, op, value).get();
    snap.docs.forEach((d) => markDelete(d.ref));
  };

  // 1. Lo que la persona creó
  await deleteWhere("events", "organizerId", "==", uid);
  await deleteWhere("posts", "userId", "==", uid);
  await deleteWhere("messages", "senderId", "==", uid);
  await deleteWhere("notifications", "toUserId", "==", uid);
  await deleteWhere("notifications", "fromUserId", "==", uid);
  await deleteWhere("reports", "reporterId", "==", uid);
  await deleteWhere("ads", "advertiserId", "==", uid);
  await deleteWhere("advertiserRequests", "userId", "==", uid);
  await deleteWhere("blocks", "blockerId", "==", uid);
  await deleteWhere("blocks", "blockedId", "==", uid);

  // 2. Chats. Los directos y los grupos propios se borran completos, con los
  // mensajes de todos: sin la otra parte (o sin el dueño) la conversación
  // queda huérfana. De los grupos ajenos solo se sale.
  const chatsSnap = await db.collection("chats").where("participants", "array-contains", uid).get();
  for (const chat of chatsSnap.docs) {
    const c = chat.data();
    if (c.type === "group" && c.ownerId !== uid) {
      markUpdate(chat.ref, {
        participants: FieldValue.arrayRemove(uid),
        unreadFor: FieldValue.arrayRemove(uid),
      });
    } else {
      const msgs = await db.collection("messages").where("chatId", "==", chat.id).get();
      msgs.docs.forEach((m) => markDelete(m.ref));
      markDelete(chat.ref);
    }
  }

  // 3. Su uid dentro de documentos ajenos
  for (const field of ["followers", "following", "followRequests"]) {
    const snap = await db.collection("users").where(field, "array-contains", uid).get();
    snap.docs.forEach((d) => markUpdate(d.ref, { [field]: FieldValue.arrayRemove(uid) }));
  }
  for (const field of ["likes", "attendees", "savedBy"]) {
    const snap = await db.collection("events").where(field, "array-contains", uid).get();
    snap.docs.forEach((d) => markUpdate(d.ref, { [field]: FieldValue.arrayRemove(uid) }));
  }
  const likedPosts = await db.collection("posts").where("likes", "array-contains", uid).get();
  likedPosts.docs.forEach((d) => markUpdate(d.ref, { likes: FieldValue.arrayRemove(uid) }));

  // Comentarios: viven en arrays de objetos, que Firestore no deja consultar
  // por autor, así que hay que recorrer las colecciones. Aceptable a esta
  // escala; cuando crezca, mover comentarios a subcolección (ver la nota en
  // firestore.rules) y borrar con una consulta.
  for (const col of ["events", "posts"]) {
    const snap = await db.collection(col).select("comments").get();
    for (const d of snap.docs) {
      const comments = d.data().comments;
      if (!Array.isArray(comments)) continue;
      const kept = comments.filter((c) => commentAuthorId(c) !== uid);
      if (kept.length !== comments.length) markUpdate(d.ref, { comments: kept });
    }
  }

  // 4. Docs propios
  markDelete(db.collection("feeds").doc(uid));
  markDelete(db.collection("users").doc(uid));

  // close() no rechaza si falla una escritura suelta; esperando cada promesa
  // el error sube y la función devuelve "internal" para que se reintente.
  const ops = [];
  toDelete.forEach((ref) => ops.push(writer.delete(ref)));
  toUpdate.forEach(({ ref, data }, path) => {
    if (!toDelete.has(path)) ops.push(writer.update(ref, data));
  });
  await writer.close();
  await Promise.all(ops);

  // userSignals/{uid} tiene la subcolección interactions
  await db.recursiveDelete(db.collection("userSignals").doc(uid));

  // 5. Storage: fotos de eventos, avatar, portada, publicaciones, anuncios y chats
  const bucket = admin.storage().bucket();
  await Promise.all(
    USER_STORAGE_PREFIXES.map((p) => bucket.deleteFiles({ prefix: `${p}/${uid}/` }))
  );
}

exports.confirmAccountDeletion = onCall(
  { timeoutSeconds: 300, memory: "512MiB" },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Debés estar autenticado");

    const code = String(request.data?.code || "").trim();
    if (!/^\d{6}$/.test(code)) {
      throw new HttpsError("invalid-argument", "Código inválido");
    }

    const reqRef = db.collection("accountDeletionRequests").doc(uid);
    const snap = await reqRef.get();
    if (!snap.exists) {
      throw new HttpsError("failed-precondition", "Pedí un código primero");
    }

    const data = snap.data();
    if (data.expiresAt.toMillis() < Date.now()) {
      await reqRef.delete();
      throw new HttpsError("deadline-exceeded", "El código venció, pedí uno nuevo");
    }
    if (data.attempts >= DELETION_MAX_ATTEMPTS) {
      await reqRef.delete();
      throw new HttpsError("resource-exhausted", "Demasiados intentos, pedí un código nuevo");
    }
    if (hashDeletionCode(code) !== data.codeHash) {
      await reqRef.update({ attempts: admin.firestore.FieldValue.increment(1) });
      throw new HttpsError("invalid-argument", "Código incorrecto");
    }

    // El pedido se borra al final: si algo falla a la mitad, el código sigue
    // vigente y la persona puede reintentar sin pedir otro.
    try {
      await deleteAllUserData(uid);
      await admin.auth().deleteUser(uid);
    } catch (err) {
      console.error(`confirmAccountDeletion(${uid}) falló:`, err);
      throw new HttpsError("internal", "No se pudo terminar de eliminar tu cuenta. Intentá de nuevo.");
    }
    await reqRef.delete();

    return { deleted: true };
  }
);

// ─── Acceso anticipado (formulario de la landing) ─────────────────────────────
// public/index.html no puede correr JavaScript (CSP script-src 'none'), así que
// el formulario es un <form method="post"> clásico. Hosting reescribe
// /api/acceso-anticipado a esta función (ver firebase.json), con lo que el POST
// queda en el mismo origen y alcanza con form-action 'self'.
//
// Las solicitudes van a earlyAccessRequests, que no tiene regla en
// firestore.rules: ningún cliente la lee ni la escribe, solo el Admin SDK.
const { onRequest } = require("firebase-functions/v2/https");

const EARLY_ACCESS_MAX_PER_HOUR = 5;
const EARLY_ACCESS_LIMITS = { name: 120, email: 160, phone: 30, description: 2000 };

function cleanField(v, max) {
  return String(Array.isArray(v) ? v[0] : v ?? "").trim().slice(0, max);
}

exports.earlyAccessRequest = onRequest({ cors: false, secrets: [EMAIL_SMTP_PASSWORD] }, async (req, res) => {
  if (req.method !== "POST") {
    res.redirect(303, "/#acceso");
    return;
  }

  const body = req.body || {};
  // Honeypot: campo oculto que una persona nunca ve. Si viene lleno es un
  // bot; se le responde como si todo hubiera salido bien.
  if (cleanField(body.website, 200)) {
    res.redirect(303, "/acceso-enviado");
    return;
  }

  const name = cleanField(body.name, EARLY_ACCESS_LIMITS.name);
  const email = cleanField(body.email, EARLY_ACCESS_LIMITS.email).toLowerCase();
  const phone = cleanField(body.phone, EARLY_ACCESS_LIMITS.phone);
  const description = cleanField(body.description, EARLY_ACCESS_LIMITS.description);

  const valid =
    name.length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) &&
    phone.replace(/\D/g, "").length >= 8 &&
    /^[\d\s+()-]+$/.test(phone) &&
    description.length >= 10;
  if (!valid) {
    res.redirect(303, "/acceso-error");
    return;
  }

  // Límite por IP, guardada solo como hash: alcanza para frenar a alguien que
  // manda el formulario en bucle sin guardar la IP de nadie.
  const ip = (req.headers["x-forwarded-for"] || req.ip || "").toString().split(",")[0].trim();
  const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
  const db = admin.firestore();
  const since = admin.firestore.Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
  // Si el conteo falla (p. ej. el índice ipHash+createdAt todavía se está
  // construyendo) se guarda igual: perder una solicitud real es peor que
  // dejar pasar una de más.
  try {
    const recent = await db.collection("earlyAccessRequests")
      .where("ipHash", "==", ipHash)
      .where("createdAt", ">=", since)
      .count().get();
    if (recent.data().count >= EARLY_ACCESS_MAX_PER_HOUR) {
      res.redirect(303, "/acceso-enviado");
      return;
    }
  } catch (e) {
    console.warn("earlyAccessRequest: sin límite por IP", e.message);
  }

  let docRef;
  try {
    docRef = await db.collection("earlyAccessRequests").add({
      name, email, phone, description, ipHash,
      status: "nueva",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error("earlyAccessRequest", e);
    res.redirect(303, "/acceso-error");
    return;
  }

  // Aviso a info@ con los datos. Si el correo falla la solicitud ya quedó
  // guardada en Firestore, así que a la persona se le muestra "enviado" igual.
  // replyTo = el correo de quien la mandó, para contestarle directo.
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.hostinger.com",
      port: 465,
      secure: true,
      auth: { user: DELETION_SENDER_EMAIL, pass: EMAIL_SMTP_PASSWORD.value() },
    });
    await transporter.sendMail({
      from: `Enfiestados <${DELETION_SENDER_EMAIL}>`,
      to: DELETION_SENDER_EMAIL,
      replyTo: email,
      subject: `Nueva solicitud de acceso anticipado: ${name.replace(/[\r\n]+/g, " ")}`,
      text:
        "Llegó una nueva solicitud de acceso anticipado desde la página web.\n\n" +
        `Empresa o persona: ${name}\n` +
        `Correo: ${email}\n` +
        `Teléfono: ${phone}\n\n` +
        `Descripción de la solicitud:\n${description}\n\n` +
        `Fecha: ${new Date().toLocaleString("es-CR", { timeZone: "America/Costa_Rica" })}\n` +
        `ID en Firestore: earlyAccessRequests/${docRef.id}\n\n` +
        "Podés responder este correo para contestarle directamente.",
    });
  } catch (e) {
    console.error("earlyAccessRequest: no se pudo enviar el correo", e.message);
  }
  res.redirect(303, "/acceso-enviado");
});

// ─── Eliminar cuenta desde la web (public/cuenta.html) ───────────────────────
// Google Play exige un enlace web para pedir el borrado de la cuenta sin tener
// la app instalada. Como la landing no corre JavaScript (CSP script-src
// 'none'), todo son formularios clásicos que Hosting reescribe a esta función
// (/api/eliminar-cuenta/** en firebase.json):
//   POST /solicitar  { email }  → manda un enlace de confirmación al correo
//   GET  /confirmar?t=TOKEN     → página "¿Seguro?" con un botón
//   POST /confirmar  { t }      → borra todo (deleteAllUserData) y la cuenta
// El GET no borra nada a propósito: los filtros de correo abren los enlaces
// para revisarlos, y eso no puede eliminar una cuenta.
//
// El token se guarda hasheado (el id del doc es el sha256) en
// webDeletionRequests, sin regla en firestore.rules: solo el Admin SDK.
const WEB_DELETION_TTL_MS = 60 * 60 * 1000;
const WEB_DELETION_MAX_PER_HOUR = 5;
const SITE_URL = "https://enfiestados.net";

const hashToken = (t) => crypto.createHash("sha256").update(t).digest("hex");
const validToken = (t) => /^[A-Za-z0-9_-]{43}$/.test(t);

async function findWebDeletion(token) {
  if (!validToken(token)) return null;
  const ref = db.collection("webDeletionRequests").doc(hashToken(token));
  const snap = await ref.get();
  if (!snap.exists) return null;
  if (snap.data().expiresAt.toMillis() < Date.now()) {
    await ref.delete();
    return null;
  }
  return { ref, uid: snap.data().uid };
}

function deletionConfirmPage(token) {
  // El token ya pasó validToken: solo tiene [A-Za-z0-9_-], no hay que escaparlo.
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Confirmar eliminación — Enfiestados</title>
<link rel="icon" href="/assets/logo.png">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{--tinta:#1F1C2C;--tinta-2:#5E5A70;--crema:#FBFAF7;--borde:#EDE8E1;--amarillo:#FDC74A;}
*{box-sizing:border-box;}
html,body{margin:0;min-height:100%;background:var(--crema);}
body{font-family:'DM Sans',sans-serif;color:var(--tinta);display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;}
.card{background:#fff;border:1px solid var(--borde);border-radius:32px;padding:48px 40px;max-width:560px;width:100%;text-align:center;display:flex;flex-direction:column;align-items:center;gap:18px;}
.card img{width:84px;height:84px;border-radius:20px;}
h1{font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:clamp(26px,5vw,34px);letter-spacing:-0.025em;line-height:1.1;margin:0;}
p{margin:0;font-size:17px;line-height:1.6;color:var(--tinta-2);}
form{display:flex;flex-direction:column;align-items:center;gap:14px;margin-top:8px;}
button{font:inherit;font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:16px;border:0;cursor:pointer;background:#B42318;color:#fff;border-radius:999px;padding:14px 28px;}
button:hover{background:#912018;}
a{color:var(--tinta-2);}
:focus-visible{outline:2px solid var(--tinta);outline-offset:3px;}
</style></head><body>
<main class="card">
  <img src="/assets/logo.png" alt="Enfiestados">
  <h1>¿Eliminar tu cuenta?</h1>
  <p>Se van a borrar tu perfil, tus eventos, publicaciones, mensajes, fotos y todo lo demás asociado a tu cuenta. Esto no se puede deshacer.</p>
  <form method="post" action="/api/eliminar-cuenta/confirmar">
    <input type="hidden" name="t" value="${token}">
    <button type="submit">Sí, eliminar mi cuenta</button>
    <a href="/">No, volver al inicio</a>
  </form>
</main>
</body></html>`;
}

exports.webAccountDeletion = onRequest(
  { cors: false, secrets: [EMAIL_SMTP_PASSWORD], timeoutSeconds: 300, memory: "512MiB" },
  async (req, res) => {
    const action = req.path.replace(/\/+$/, "").split("/").pop();
    const body = req.body || {};

    if (action === "solicitar" && req.method === "POST") {
      // Siempre la misma respuesta, exista o no la cuenta: la página no
      // puede servir para averiguar quién está registrado.
      const done = () => res.redirect(303, "/cuenta-enviado");
      if (cleanField(body.website, 200)) return done(); // honeypot
      const email = cleanField(body.email, 160).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return done();

      try {
        const ip = (req.headers["x-forwarded-for"] || req.ip || "").toString().split(",")[0].trim();
        const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
        const since = admin.firestore.Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
        // Si el conteo falla (índice todavía construyéndose) se sigue igual.
        try {
          const recent = await db.collection("webDeletionRequests")
            .where("ipHash", "==", ipHash)
            .where("createdAt", ">=", since)
            .count().get();
          if (recent.data().count >= WEB_DELETION_MAX_PER_HOUR) return done();
        } catch (e) {
          console.warn("webAccountDeletion: sin límite por IP", e.message);
        }

        let user;
        try {
          user = await admin.auth().getUserByEmail(email);
        } catch (e) {
          if (e.code === "auth/user-not-found") return done();
          throw e;
        }

        const token = crypto.randomBytes(32).toString("base64url");
        await db.collection("webDeletionRequests").doc(hashToken(token)).set({
          uid: user.uid,
          ipHash,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + WEB_DELETION_TTL_MS),
        });

        const link = `${SITE_URL}/api/eliminar-cuenta/confirmar?t=${token}`;
        const transporter = nodemailer.createTransport({
          host: "smtp.hostinger.com",
          port: 465,
          secure: true,
          auth: { user: DELETION_SENDER_EMAIL, pass: EMAIL_SMTP_PASSWORD.value() },
        });
        await transporter.sendMail({
          from: `Enfiestados <${DELETION_SENDER_EMAIL}>`,
          to: email,
          subject: "Confirmá la eliminación de tu cuenta de Enfiestados",
          text:
            "Recibimos una solicitud para eliminar tu cuenta de Enfiestados.\n\n" +
            `Para confirmarla, abrí este enlace:\n${link}\n\n` +
            "El enlace vence en una hora. Al abrirlo te vamos a pedir que confirmes una vez más.\n\n" +
            "Si no pediste esto, ignorá este correo: tu cuenta sigue segura y no se elimina nada.\n\n" +
            "— Enfiestados",
        });
      } catch (e) {
        console.error("webAccountDeletion/solicitar", e);
      }
      return done();
    }

    if (action === "confirmar" && req.method === "GET") {
      const token = cleanField(req.query.t, 64);
      const found = await findWebDeletion(token);
      if (!found) return res.redirect(303, "/cuenta-error");
      res.set("Cache-Control", "no-store");
      res.status(200).type("html").send(deletionConfirmPage(token));
      return;
    }

    if (action === "confirmar" && req.method === "POST") {
      const found = await findWebDeletion(cleanField(body.t, 64));
      if (!found) return res.redirect(303, "/cuenta-error");
      // Igual que confirmAccountDeletion: el pedido se borra al final, así un
      // fallo a la mitad se puede reintentar con el mismo enlace.
      try {
        await deleteAllUserData(found.uid);
        await admin.auth().deleteUser(found.uid).catch((e) => {
          if (e.code !== "auth/user-not-found") throw e;
        });
      } catch (e) {
        console.error(`webAccountDeletion(${found.uid}) falló:`, e);
        res.status(500).type("text").send("No se pudo terminar de eliminar tu cuenta. Volvé a abrir el enlace del correo e intentá de nuevo.");
        return;
      }
      // Cualquier otro enlace pendiente de la misma cuenta ya no sirve.
      const others = await db.collection("webDeletionRequests").where("uid", "==", found.uid).get();
      await Promise.all(others.docs.map((d) => d.ref.delete()));
      return res.redirect(303, "/cuenta-eliminada");
    }

    res.redirect(303, "/cuenta");
  }
);

// ─── Privacidad de eventos (perfiles privados) ───────────────────────────────
// Un evento de un perfil privado solo lo ven el organizador y sus seguidores
// aprobados. firestore.rules lo hace cumplir con dos campos del evento:
//   organizerPrivate: bool  — el organizador es privado
//   viewers: [uid]          — organizador + seguidores (vacío si es público)
// Estas funciones los mantienen al día. La app los pone al crear el evento
// (eventService.createEvent), pero la fuente de verdad es esto: también
// corrige eventos creados por versiones viejas de la app sin esos campos.

function eventPrivacyFor(organizerId, userData) {
  const isPrivate = userData?.perfilPublico === false;
  return {
    organizerPrivate: isPrivate,
    viewers: isPrivate ? [organizerId, ...new Set(userData?.followers || [])] : [],
  };
}

function samePrivacy(a, b) {
  return a.organizerPrivate === b.organizerPrivate &&
    JSON.stringify([...(a.viewers || [])].sort()) === JSON.stringify([...(b.viewers || [])].sort());
}

async function syncOrganizerEvents(organizerId, userData) {
  const target = eventPrivacyFor(organizerId, userData);
  const snap = await db.collection("events").where("organizerId", "==", organizerId).get();
  const writer = db.bulkWriter();
  let n = 0;
  snap.docs.forEach((d) => {
    if (!samePrivacy(d.data(), target)) { writer.update(d.ref, target); n++; }
  });
  await writer.close();
  return n;
}

// El usuario cambió de público a privado (o al revés), o ganó/perdió
// seguidores: se actualizan todos sus eventos.
exports.syncEventPrivacyOnUserUpdate = onDocumentUpdated("users/{uid}", async (event) => {
  const before = event.data?.before?.data() || {};
  const after = event.data?.after?.data() || {};
  const privacyChanged = (before.perfilPublico === false) !== (after.perfilPublico === false);
  const followersChanged = after.perfilPublico === false &&
    JSON.stringify([...(before.followers || [])].sort()) !== JSON.stringify([...(after.followers || [])].sort());
  if (!privacyChanged && !followersChanged) return;
  const n = await syncOrganizerEvents(event.params.uid, after);
  console.log(`syncEventPrivacy: ${event.params.uid} → ${n} evento(s) actualizados`);
});

// Evento nuevo: se asegura de que nazca con la privacidad de su organizador.
exports.syncEventPrivacyOnEventCreate = onDocumentCreated("events/{eventId}", async (event) => {
  const data = event.data?.data();
  if (!data?.organizerId) return;
  const userSnap = await db.collection("users").doc(data.organizerId).get();
  const target = eventPrivacyFor(data.organizerId, userSnap.data());
  if (!samePrivacy(data, target)) await event.data.ref.update(target);
});

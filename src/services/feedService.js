// Scoring client-side del feed — v1 (sin Cloud Functions)
// Cuando el volumen lo requiera, esta lógica se mueve a una Cloud Function
// que pre-computa feeds/{userId} y la app solo lee esa lista.

const WEIGHTS = {
  affinity: 0.40,   // interés del usuario en la categoría
  popularity: 0.25, // likes + asistentes (escala log)
  recency: 0.25,    // qué tan pronto es el evento
  social: 0.10,     // reservado para señal de amigos (v2)
};

const categoryAffinityScore = (event, interestVector) => {
  if (!event.category || !interestVector) return 0;
  return interestVector[event.category.toLowerCase()] || 0;
};

const popularityScore = (event) => {
  const count = (event.likes?.length || 0) + (event.attendees?.length || 0);
  // log10 para que 10 interacciones = ~0.5, 100 = ~1.0
  return Math.min(1, Math.log10(count + 1) / 2);
};

const recencyScore = (event) => {
  try {
    let ts;
    if (event._isExternal) {
      ts = event.dateISO ? new Date(event.dateISO).getTime() : null;
    } else {
      const parts = event.date?.split('/');
      if (parts?.length === 3) {
        ts = new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime();
      }
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
};

// Construye un interestVector inicial desde el array de intereses del usuario.
// Si ya tiene historial (interestVector no vacío) ese tiene precedencia.
// Si es cold start (sin historial), usa interests[] con valor 0.5 como arranque.
const buildEffectiveVector = (interestVector, interests = []) => {
  const hasHistory = Object.keys(interestVector).length > 0;
  if (hasHistory) return interestVector;
  const cold = {};
  interests.forEach(id => { cold[id] = 0.5; });
  return cold;
};

// Ordena eventos por score personalizado.
// interestVector: { musica: 0.8, deporte: 0.3, ... } (de users/{userId}.interestVector)
// interests: string[] intereses seleccionados en onboarding (cold start)
// hiddenIds: Set<string> de eventos que el usuario ocultó
export const scoreAndRankEvents = (events, interestVector = {}, hiddenIds = new Set(), interests = []) => {
  const vector = buildEffectiveVector(interestVector, interests);
  return events
    .filter(ev => !hiddenIds.has(ev.id))
    .map(ev => {
      const score =
        WEIGHTS.affinity * categoryAffinityScore(ev, vector) +
        WEIGHTS.popularity * popularityScore(ev) +
        WEIGHTS.recency * recencyScore(ev);
      return { ...ev, _score: score };
    })
    .sort((a, b) => b._score - a._score);
};

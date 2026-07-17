import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';

// Pesos por tipo de señal sobre el vector de intereses
const INTEREST_WEIGHTS = {
  like: 0.3,
  attend: 0.5,
  comment: 0.2,
  open: 0.1,
  longView: 0.05,
  hide: -0.5,
};

// Factor de decaimiento aplicado al vector existente en cada actualización
const DECAY = 0.95;

// Registra una señal de comportamiento del usuario sobre un evento.
// signalType: 'view' | 'longView' | 'open' | 'like' | 'unlike' | 'attend' | 'unattend' | 'comment' | 'hide'
export const recordSignal = async (userId, event, signalType) => {
  if (!userId || !event?.id || event?._isExternal) return;

  try {
    const interactionRef = doc(db, 'userSignals', userId, 'interactions', event.id);

    const updates = {};
    if (signalType === 'view') {
      updates.viewCount = 1; // se acumula con merge
    } else if (signalType === 'longView') {
      updates.longViewCount = 1;
    } else if (signalType === 'open') {
      updates.opened = true;
    } else if (signalType === 'like') {
      updates.liked = true;
    } else if (signalType === 'unlike') {
      updates.liked = false;
    } else if (signalType === 'attend') {
      updates.attended = true;
    } else if (signalType === 'unattend') {
      updates.attended = false;
    } else if (signalType === 'comment') {
      updates.commented = true;
    } else if (signalType === 'hide') {
      updates.hidden = true;
    }

    if (event.category) updates.category = event.category;

    // Para contadores usamos getDoc + set manual para evitar import de increment
    if (signalType === 'view' || signalType === 'longView') {
      const snap = await getDoc(interactionRef);
      const existing = snap.exists() ? snap.data() : {};
      const field = signalType === 'view' ? 'viewCount' : 'longViewCount';
      updates[field] = (existing[field] || 0) + 1;
    }

    await setDoc(interactionRef, updates, { merge: true });

    const weight = INTEREST_WEIGHTS[signalType];
    if (weight && event.category) {
      await _updateInterestVector(userId, event.category, weight);
    }
  } catch {
    // señales son no-críticas, se ignoran errores silenciosamente
  }
};

const _updateInterestVector = async (userId, category, weight) => {
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;

    const current = snap.data().interestVector || {};
    const decayed = Object.fromEntries(
      Object.entries(current).map(([k, v]) => [k, Math.max(0, v * DECAY)])
    );
    decayed[category] = Math.min(1, Math.max(0, (decayed[category] || 0) + weight));

    await updateDoc(userRef, { interestVector: decayed });
  } catch {
    // non-critical
  }
};

// Devuelve el set de IDs de eventos que el usuario ocultó
export const getHiddenEventIds = async (userId) => {
  if (!userId) return new Set();
  try {
    const interactionsRef = collection(db, 'userSignals', userId, 'interactions');
    const q = query(interactionsRef, where('hidden', '==', true));
    const snap = await getDocs(q);
    return new Set(snap.docs.map(d => d.id));
  } catch {
    return new Set();
  }
};

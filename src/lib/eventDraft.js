import AsyncStorage from '@react-native-async-storage/async-storage';

// Borrador de "Crear evento". Uno por usuario, guardado en el teléfono.
// Las imágenes ya están subidas a Storage (ImageGridPicker sube en cuanto se
// eligen), así que el borrador solo guarda sus URLs.
const keyFor = uid => `eventDraft:${uid}`;

export async function loadEventDraft(uid) {
  if (!uid) return null;
  try {
    const raw = await AsyncStorage.getItem(keyFor(uid));
    if (!raw) return null;
    const d = JSON.parse(raw);
    return {
      ...d,
      date: d.date ? new Date(d.date) : new Date(),
      time: d.time ? new Date(d.time) : new Date(),
    };
  } catch {
    return null;
  }
}

export async function saveEventDraft(uid, draft) {
  if (!uid) return;
  try {
    await AsyncStorage.setItem(keyFor(uid), JSON.stringify({
      ...draft,
      date: draft.date?.toISOString?.() ?? null,
      time: draft.time?.toISOString?.() ?? null,
      savedAt: Date.now(),
    }));
  } catch {}
}

export async function clearEventDraft(uid) {
  if (!uid) return;
  try { await AsyncStorage.removeItem(keyFor(uid)); } catch {}
}

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export async function fetchActiveAds({ province, interests = [] } = {}) {
  try {
    const now = new Date();
    const q = query(
      collection(db, 'ads'),
      where('status', '==', 'active'),
      where('endDate', '>=', now),
      orderBy('endDate'),
      limit(20)
    );
    const snap = await getDocs(q);
    const ads = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Ordenar: targeting específico que coincide primero
    return ads.sort((a, b) => {
      const aScore =
        (a.province && a.province === province ? 2 : 0) +
        (a.category && interests.includes(a.category) ? 1 : 0);
      const bScore =
        (b.province && b.province === province ? 2 : 0) +
        (b.category && interests.includes(b.category) ? 1 : 0);
      return bScore - aScore;
    });
  } catch {
    return [];
  }
}

export async function recordImpression(adId) {
  try {
    await updateDoc(doc(db, 'ads', adId), { impressions: increment(1) });
  } catch {}
}

export async function recordClick(adId) {
  try {
    await updateDoc(doc(db, 'ads', adId), { clicks: increment(1) });
  } catch {}
}

export async function createAd(advertiserId, advertiserName, data) {
  const ref = await addDoc(collection(db, 'ads'), {
    advertiserId,
    advertiserName,
    type: data.type,
    title: data.title,
    description: data.description,
    image: data.image || '',
    ctaLabel: data.ctaLabel || 'Ver más',
    targetUrl: data.targetUrl || '',
    eventId: data.eventId || '',
    status: 'pending',
    rejectionReason: '',
    province: data.province || null,
    category: data.category || null,
    impressions: 0,
    clicks: 0,
    startDate: data.startDate,
    endDate: data.endDate,
    budget: data.budget || 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getMyAds(advertiserId) {
  const q = query(
    collection(db, 'ads'),
    where('advertiserId', '==', advertiserId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function pauseAd(adId) {
  await updateDoc(doc(db, 'ads', adId), {
    status: 'paused',
    updatedAt: serverTimestamp(),
  });
}

export async function resumeAd(adId) {
  await updateDoc(doc(db, 'ads', adId), {
    status: 'active',
    updatedAt: serverTimestamp(),
  });
}

export async function submitAdvertiserRequest(userId, data) {
  const existing = await getDocs(
    query(collection(db, 'advertiserRequests'), where('userId', '==', userId))
  );
  if (!existing.empty) throw new Error('Ya tienes una solicitud enviada');

  await addDoc(collection(db, 'advertiserRequests'), {
    userId,
    businessName: data.businessName,
    businessType: data.businessType,
    contact: data.contact,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

// Admin only
export async function getPendingAds() {
  const q = query(
    collection(db, 'ads'),
    where('status', '==', 'pending'),
    orderBy('createdAt')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function approveAd(adId) {
  await updateDoc(doc(db, 'ads', adId), {
    status: 'active',
    updatedAt: serverTimestamp(),
  });
}

export async function rejectAd(adId, reason) {
  await updateDoc(doc(db, 'ads', adId), {
    status: 'rejected',
    rejectionReason: reason,
    updatedAt: serverTimestamp(),
  });
}

export async function getPendingAdvertiserRequests() {
  const q = query(
    collection(db, 'advertiserRequests'),
    where('status', '==', 'pending'),
    orderBy('createdAt')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function approveAdvertiserRequest(requestId, userId) {
  await updateDoc(doc(db, 'advertiserRequests', requestId), { status: 'approved' });
  await updateDoc(doc(db, 'users', userId), { isAdvertiser: true });
}

export async function rejectAdvertiserRequest(requestId) {
  await updateDoc(doc(db, 'advertiserRequests', requestId), { status: 'rejected' });
}

export async function addCredits(userId, amount) {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { adCredits: increment(amount) });
}

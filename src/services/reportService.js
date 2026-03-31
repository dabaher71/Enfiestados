import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

export const REPORT_REASONS = [
  { id: 'spam', label: 'Spam o publicidad no deseada' },
  { id: 'acoso', label: 'Acoso o bullying' },
  { id: 'contenido_inapropiado', label: 'Contenido inapropiado' },
  { id: 'cuenta_falsa', label: 'Cuenta falsa o suplantación de identidad' },
  { id: 'violencia', label: 'Violencia o contenido peligroso' },
  { id: 'otro', label: 'Otro' },
];

export const createReport = async ({ reporterId, targetType, targetId, reason }) => {
  // Verificar duplicado: solo filtramos por reporterId (un campo = sin índice compuesto requerido)
  // y filtramos targetId localmente
  const existing = await getDocs(
    query(
      collection(db, 'reports'),
      where('reporterId', '==', reporterId)
    )
  );
  const alreadyReported = existing.docs.some(d => d.data().targetId === targetId);
  if (alreadyReported) {
    throw new Error('Ya reportaste este contenido anteriormente');
  }
  return addDoc(collection(db, 'reports'), {
    reporterId,
    targetType, // 'user' | 'event' | 'post'
    targetId,
    reason,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
};

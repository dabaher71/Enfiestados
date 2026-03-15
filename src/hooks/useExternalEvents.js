import { useEffect, useState } from 'react';
import { fetchExternalEvents } from '../services/externalEventService';

/**
 * Hook para consumir eventos_externos desde Firestore.
 * Usa getDocs (lectura única) — sin listeners, sin fugas de memoria.
 *
 * @returns {{ data: object[], loading: boolean, error: Error|null }}
 */
export default function useExternalEvents() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    fetchExternalEvents()
      .then(events => {
        if (!cancelled) {
          setData(events);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.error('[useExternalEvents]', err);
          setError(err);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
}

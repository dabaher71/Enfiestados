import { AccessibilityInfo, useEffect, useState } from 'react';

// Respeta la preferencia del sistema "Reducir movimiento" (WCAG 2.3)
export default function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub?.remove();
  }, []);

  return reduced;
}

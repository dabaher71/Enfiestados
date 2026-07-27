import { AccessibilityInfo } from 'react-native';
import { useEffect, useState } from 'react';

export default function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (!AccessibilityInfo?.isReduceMotionEnabled) return;
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduced);
    return () => sub?.remove?.();
  }, []);

  return reduced;
}

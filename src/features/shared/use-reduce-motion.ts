import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Null until the setting is known, so that an animation does not start before it is read.
export function useReduceMotion(): boolean | null {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(
      (enabled) => active && setReduceMotion(enabled),
      () => active && setReduceMotion(true),
    );
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduceMotion;
}

import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { breathingStep, type BreathingPhase } from '@/domain/urge';
import { useClock, useTickClock } from '@/features/clock/clock-context';
import { sameFields } from '@/features/clock/minute-clock';
import { nativeClockDeps } from '@/features/clock/native-clock';
import { breathingLabel } from '@/features/emergency/labels';
import { useReduceMotion } from '@/features/shared/use-reduce-motion';
import { colors, sizes, spacing, typography } from '@/ui/theme';

const SMALL = 0.7;

const SCALES: Record<BreathingPhase, readonly [number, number]> = {
  inhale: [SMALL, 1],
  hold: [1, 1],
  exhale: [1, SMALL],
};

const EASING = Easing.inOut(Easing.sin);

// Module-level selectors, so the clock subscriptions stay the same from one render to the next.
function shownStep(elapsed: number) {
  const { phase, secondsLeft } = breathingStep(elapsed);
  return { phase, secondsLeft };
}

function phaseIndex(elapsed: number): number {
  return breathingStep(elapsed).index;
}

// Counts the returns to the foreground, once the screen's clock has read the time again.
function useForegroundCount(): number {
  const [count, setCount] = useState(0);
  useEffect(
    () =>
      nativeClockDeps.watchActivity((activity) => {
        if (activity === 'foreground') queueMicrotask(() => setCount((value) => value + 1));
      }),
    [],
  );
  return count;
}

// The circle grows on the inhale, stays on the hold and shrinks on the exhale, on the screen's
// elapsed clock. With reduce motion on, only the text changes.
//
// Screen readers hear the rhythm once when the screen opens. After that, the phase is the value
// of the breathing guide, read again as it changes only while the guide has focus: iOS re-reads a
// focused element that updates frequently, which the progress bar role gives it, and TalkBack
// re-reads the focused element when its description changes. React Native has no accessibility
// focus event to do more.
export function BreathingCircle() {
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const clock = useTickClock();
  const shown = useClock(shownStep, sameFields);
  const index = useClock(phaseIndex);
  const resumes = useForegroundCount();
  const [scale] = useState(() => new Animated.Value(1));
  const [rhythm] = useState(() => t('emergency.breathing.rhythm'));
  const label = breathingLabel(t, shown.phase);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(rhythm);
  }, [rhythm]);

  // Starts again at each phase and after each return to the foreground, from where the elapsed
  // time puts it: a native animation paused in the background would otherwise lag behind the text.
  useEffect(() => {
    if (reduceMotion !== false) {
      scale.setValue(1);
      return;
    }
    const step = breathingStep(clock.now());
    const [from, to] = SCALES[step.phase];
    scale.setValue(from + (to - from) * EASING(step.progress));
    const animation = Animated.timing(scale, {
      toValue: to,
      duration: step.msLeft,
      easing: EASING,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [index, resumes, reduceMotion, scale, clock]);

  return (
    <View style={styles.container}>
      <View
        accessible
        accessibilityLabel={t('emergency.breathing.guide')}
        accessibilityValue={{ text: label }}
        accessibilityRole={Platform.OS === 'ios' ? 'progressbar' : undefined}
        style={styles.ring}
      >
        <Animated.View style={[styles.circle, { transform: [{ scale }] }]} />
        <View style={styles.center}>
          <Text style={styles.phase}>{label}</Text>
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            maxFontSizeMultiplier={1}
            style={styles.count}
          >
            {shown.secondsLeft}
          </Text>
        </View>
      </View>
      <Text style={styles.rhythm}>{rhythm}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.l,
  },
  ring: {
    width: sizes.breathingRing,
    height: sizes.breathingRing,
    borderRadius: sizes.breathingRing / 2,
    borderWidth: 1,
    borderColor: colors.separator,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: sizes.breathingCircle,
    height: sizes.breathingCircle,
    borderRadius: sizes.breathingCircle / 2,
    borderWidth: sizes.breathingStroke,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phase: {
    ...typography.breathingPhase,
    color: colors.text,
  },
  count: {
    ...typography.breathingCount,
    color: colors.text,
  },
  rhythm: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
  },
});

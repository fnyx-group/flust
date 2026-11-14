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

import type { Timestamp } from '@/domain/time';
import { breathingStep, type BreathingPhase, type BreathingStep } from '@/domain/urge';
import { useClock } from '@/features/clock/clock-context';
import { sameFields } from '@/features/clock/minute-clock';
import { breathingLabel } from '@/features/emergency/labels';
import { useReduceMotion } from '@/features/shared/use-reduce-motion';
import { colors, sizes, spacing, typography } from '@/ui/theme';

const SMALL = 0.7;

const SCALES: Record<BreathingPhase, readonly [number, number]> = {
  inhale: [SMALL, 1],
  hold: [1, 1],
  exhale: [1, SMALL],
};

function samePhase(a: BreathingStep, b: BreathingStep): boolean {
  return a.index === b.index;
}

// The circle grows on the inhale, stays on the hold and shrinks on the exhale. Each phase starts
// from where the elapsed time puts it, so coming back from the background never restarts it.
// With reduce motion on, only the text changes.
export function BreathingCircle({ openedAt }: { openedAt: Timestamp }) {
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const shown = useClock((now) => {
    const { phase, secondsLeft } = breathingStep(now - openedAt);
    return { phase, secondsLeft };
  }, sameFields);
  const step = useClock((now) => breathingStep(now - openedAt), samePhase);
  const [scale] = useState(() => new Animated.Value(1));
  const label = breathingLabel(t, shown.phase);

  useEffect(() => {
    if (reduceMotion !== false) {
      scale.setValue(1);
      return;
    }
    const [from, to] = SCALES[step.phase];
    scale.setValue(from + (to - from) * step.progress);
    const animation = Animated.timing(scale, {
      toValue: to,
      duration: step.msLeft,
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [step, reduceMotion, scale]);

  // Android reads the phase through its live region; iOS has none, so it is announced there.
  // Consecutive phases always have different names, so this runs once per phase.
  useEffect(() => {
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(label);
  }, [label]);

  return (
    <View style={styles.container}>
      <View style={styles.ring}>
        <Animated.View style={[styles.circle, { transform: [{ scale }] }]} />
        <View style={styles.center}>
          <Text accessibilityLiveRegion="polite" style={styles.phase}>
            {label}
          </Text>
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
      <Text style={styles.rhythm}>{t('emergency.breathing.rhythm')}</Text>
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

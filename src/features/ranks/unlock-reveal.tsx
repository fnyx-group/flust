import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { Rank } from '@/domain/ranks';
import { useReduceMotion } from '@/features/shared/use-reduce-motion';
import { RankEmblem } from '@/ui/rank-emblem';
import { colors, sizes } from '@/ui/theme';

const DURATION_MS = 900;
const RING_STROKE = 1.5;
const DASHED_STROKE = 2;
const RING_DASHES = '4 8';
// Radii as fractions of half the rings' size, from the mockup.
const OUTER_RING = 0.99;
const MIDDLE_RING = 0.8;
const DASHED_RING = 0.62;

// One value from 0 to 1 drives the whole reveal: the rings, then the emblem, then the text.
// Until the reduce motion setting is read, everything stays hidden, so nothing moves and then
// jumps. With reduce motion on, the final state shows at once.
export function useRevealProgress(): Animated.Value {
  const reduceMotion = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduceMotion === null) return;
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, progress]);
  return progress;
}

export function revealTextStyle(progress: Animated.Value) {
  return {
    opacity: progress.interpolate({ inputRange: [0.5, 1], outputRange: [0, 1] }),
    transform: [
      { translateY: progress.interpolate({ inputRange: [0.5, 1], outputRange: [8, 0] }) },
    ],
  };
}

type UnlockRevealProps = { rank: Rank; progress: Animated.Value };

// Decorative: the screen announces the rank in words.
export function UnlockReveal({ rank, progress }: UnlockRevealProps) {
  const half = sizes.unlockRings / 2;
  const ringsOpacity = progress.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1] });
  const emblemOpacity = progress.interpolate({ inputRange: [0.2, 0.7], outputRange: [0, 1] });
  const emblemScale = progress.interpolate({ inputRange: [0.2, 0.7], outputRange: [0.85, 1] });
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.container}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: ringsOpacity }]}>
        <Svg width={sizes.unlockRings} height={sizes.unlockRings} fill="none">
          <Circle
            cx={half}
            cy={half}
            r={half * OUTER_RING}
            stroke={colors.surface}
            strokeWidth={RING_STROKE}
          />
          <Circle
            cx={half}
            cy={half}
            r={half * MIDDLE_RING}
            stroke={colors.separator}
            strokeWidth={RING_STROKE}
          />
          <Circle
            cx={half}
            cy={half}
            r={half * DASHED_RING}
            stroke={colors.accent}
            strokeWidth={DASHED_STROKE}
            strokeDasharray={RING_DASHES}
          />
        </Svg>
      </Animated.View>
      <Animated.View style={{ opacity: emblemOpacity, transform: [{ scale: emblemScale }] }}>
        <RankEmblem circle={rank.circle} tier={rank.tier} unlocked size={sizes.unlockEmblem} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: sizes.unlockRings,
    height: sizes.unlockRings,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

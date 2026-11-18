import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { Rank } from '@/domain/ranks';
import { useReduceMotion } from '@/features/shared/use-reduce-motion';
import { RankEmblem } from '@/ui/rank-emblem';
import { circleColors, colors, sizes, tint, tintAlpha } from '@/ui/theme';

const DURATION_MS = 900;
const RING_STROKE = 2;
const AREA = 300;
// Sparks around the ring, from the mockup: offsets from the center, radius, and whether they take
// the circle's color (the large ones) or alternate teal and violet (the small ones).
const SPARKS: readonly { x: number; y: number; r: number; own: boolean }[] = [
  { x: 20, y: -116, r: 6, own: true },
  { x: -60, y: -102, r: 4, own: false },
  { x: 97, y: -68, r: 4, own: false },
  { x: -114, y: -30, r: 7, own: true },
  { x: 116, y: 20, r: 7, own: true },
  { x: -102, y: 60, r: 4, own: false },
  { x: 68, y: 97, r: 4, own: false },
  { x: -40, y: 111, r: 6, own: true },
];
const SMALL_SPARKS = [colors.teal, colors.accent];

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
  const half = AREA / 2;
  const color = circleColors[rank.circle];
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
        <Svg width={AREA} height={AREA} fill="none">
          <Circle
            cx={half}
            cy={half}
            r={sizes.unlockRing / 2}
            stroke={tint(color, tintAlpha.border)}
            strokeWidth={RING_STROKE}
          />
          {SPARKS.map((spark, index) => (
            <Circle
              key={index}
              cx={half + spark.x}
              cy={half + spark.y}
              r={spark.r}
              fill={spark.own ? color : SMALL_SPARKS[index % SMALL_SPARKS.length]}
            />
          ))}
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
    width: AREA,
    height: AREA,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

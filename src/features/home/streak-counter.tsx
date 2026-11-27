import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Journey } from '@/domain/journey';
import { rankStanding, type RankId } from '@/domain/ranks';
import { counterSize, currentStreakMs, streakDisplay } from '@/domain/streak';
import { useClock } from '@/features/clock/clock-context';
import { sameFields } from '@/features/clock/minute-clock';
import { counterParts, spokenCounter } from '@/features/home/labels';
import { ProgressRing } from '@/ui/progress-ring';
import {
  colors,
  counterFontSize,
  maxFontScale,
  pressedOpacity,
  sizes,
  typography,
} from '@/ui/theme';

type StreakCounterProps = {
  journey: Journey;
  unlockedRanks: readonly RankId[];
  // Chosen by the home screen to fit its height (fitHome).
  ring: number;
};

// The number alone in the ring, its unit under it, and for hours the minutes on a quieter line.
// The ring fills toward the next rank, or toward the first day. None of it follows the system
// text size: the ring's size depends on the screen, and the number is already the largest text
// on screen. Screen readers read the whole counter as one sentence instead. Like the rank line,
// it opens the ranks tab, which shows where the ring is heading.
export function StreakCounter({ journey, unlockedRanks, ring }: StreakCounterProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const display = useClock((now) => streakDisplay(currentStreakMs(journey, now)), sameFields);
  const fraction = useClock((now) => rankStanding(journey, unlockedRanks, now).fraction);
  const fontSize = counterFontSize(ring, counterSize(display));
  const parts = counterParts(t, display);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spokenCounter(t, display)}
      accessibilityHint={t('home.rank.hint')}
      onPress={() => router.navigate('/ranks')}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <ProgressRing
        fraction={fraction}
        size={ring}
        strokeWidth={sizes.streakRingStroke}
        trackColor={colors.lockedFill}
      >
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={maxFontScale.streakCounter}
          style={[styles.number, { fontSize, lineHeight: fontSize }]}
        >
          {parts.number}
        </Text>
        <Text maxFontSizeMultiplier={maxFontScale.streakCounter} style={typography.streakUnit}>
          {parts.unit}
        </Text>
        {parts.rest !== null && (
          <Text maxFontSizeMultiplier={maxFontScale.streakCounter} style={typography.streakRest}>
            {parts.rest}
          </Text>
        )}
      </ProgressRing>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  pressed: {
    opacity: pressedOpacity,
  },
  number: {
    ...typography.streakNumber,
    color: colors.text,
    includeFontPadding: false,
  },
});

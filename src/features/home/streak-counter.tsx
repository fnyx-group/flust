import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Journey } from '@/domain/journey';
import { rankStanding, type RankId } from '@/domain/ranks';
import { counterSize, currentStreakMs, streakDisplay } from '@/domain/streak';
import { useClock } from '@/features/clock/clock-context';
import { sameFields } from '@/features/clock/minute-clock';
import { counterParts, spokenCounter } from '@/features/home/labels';
import { ProgressRing } from '@/ui/progress-ring';
import { colors, counterFontSizes, maxFontScale, sizes, typography } from '@/ui/theme';

type StreakCounterProps = { journey: Journey; unlockedRanks: readonly RankId[] };

// The number alone in the ring, its unit under it, and for hours the minutes on a quieter line.
// The ring fills toward the next rank, or toward the first day. None of it follows the system
// text size: the ring has a fixed size and the number is already the largest text on screen.
// Screen readers read the whole counter as one sentence instead.
export function StreakCounter({ journey, unlockedRanks }: StreakCounterProps) {
  const { t } = useTranslation();
  const display = useClock((now) => streakDisplay(currentStreakMs(journey, now)), sameFields);
  const fraction = useClock((now) => rankStanding(journey, unlockedRanks, now).fraction);
  const fontSize = counterFontSizes[counterSize(display)];
  const parts = counterParts(t, display);
  return (
    <View accessible accessibilityLabel={spokenCounter(t, display)} style={styles.container}>
      <ProgressRing
        fraction={fraction}
        size={sizes.streakRing}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  number: {
    ...typography.streakNumber,
    color: colors.text,
    includeFontPadding: false,
  },
});

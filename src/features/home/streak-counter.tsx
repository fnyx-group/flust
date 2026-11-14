import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Journey } from '@/domain/journey';
import { counterSize, currentStreakMs, streakDisplay } from '@/domain/streak';
import { useClock } from '@/features/clock/clock-context';
import { counterParts, spokenCounter } from '@/features/home/labels';
import { sameFields } from '@/features/clock/minute-clock';
import { counterFontSizes, colors, sizes, typography } from '@/ui/theme';

// One line of nested text, so digits and units share a baseline. The sizes fit the counter on a
// screen of sizes.counterDesignWidth (labels.test.ts measures it); only narrower screens shrink it.
// Digits and units do not follow the system text size, as they are already the largest text on
// screen; the whole counter is read as one sentence instead.
export function StreakCounter({ journey }: { journey: Journey }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const display = useClock((now) => streakDisplay(currentStreakMs(journey, now)), sameFields);
  const fontSize = counterFontSizes[counterSize(display)];
  return (
    <View accessible accessibilityLabel={spokenCounter(t, display)}>
      <Text style={typography.sectionLabel}>{t('home.streak.label')}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit={width < sizes.counterDesignWidth}
        maxFontSizeMultiplier={1}
        style={[styles.counter, { fontSize, lineHeight: fontSize }]}
      >
        {counterParts(t, display).map((part, index) =>
          part.kind === 'number' ? (
            part.text
          ) : (
            <Text key={index} style={typography.streakUnit}>
              {part.text}
            </Text>
          ),
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  counter: {
    ...typography.streakNumber,
    color: colors.text,
    includeFontPadding: false,
  },
});

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Journey } from '@/domain/journey';
import { counterSize, currentStreakMs, streakDisplay } from '@/domain/streak';
import type { Timestamp } from '@/domain/time';
import { useClock } from '@/features/home/clock-context';
import { spokenStreak, twoDigits } from '@/features/home/labels';
import { counterFontSizes, colors, typography } from '@/ui/theme';

const identity = (now: Timestamp) => now;

// One line of nested text, so digits and units share a baseline and shrink together if a narrow
// screen still needs it. The digits are the largest text on screen already and do not follow the
// system text size; the label above them does.
export function StreakCounter({ journey }: { journey: Journey }) {
  const { t } = useTranslation();
  const now = useClock(identity);
  const display = streakDisplay(currentStreakMs(journey, now));
  const fontSize = counterFontSizes[counterSize(display)];
  return (
    <View>
      <Text style={typography.sectionLabel}>{t('home.streak.label')}</Text>
      <Text
        accessibilityLabel={spokenStreak(t, display)}
        numberOfLines={1}
        adjustsFontSizeToFit
        maxFontSizeMultiplier={1}
        style={[styles.counter, { fontSize, lineHeight: fontSize }]}
      >
        {display.unit === 'days' ? (
          <>
            {display.days}
            <Text style={typography.streakUnit}>
              {' '}
              {t('home.streak.dayUnit', { count: display.days })}
            </Text>
          </>
        ) : (
          <>
            {display.hours}
            <Text style={typography.streakUnit}> {t('home.streak.hourUnit')} </Text>
            {twoDigits(display.minutes)}
            <Text style={typography.streakUnit}> {t('home.streak.minuteUnit')}</Text>
          </>
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

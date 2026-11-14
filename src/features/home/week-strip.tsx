import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Journey } from '@/domain/journey';
import { localDayNumber } from '@/domain/local-time';
import { weekStrip, type WeekDayStatus } from '@/domain/week';
import { useClock } from '@/features/clock/clock-context';
import { spokenWeek, weekdayInitial } from '@/features/home/labels';
import { deviceOffsetAt } from '@/features/shared/device-time';
import { colors, sizes, spacing, typography } from '@/ui/theme';

// The selector returns the local day, a number, so the strip re-renders once a day.
export function WeekStrip({ journey }: { journey: Journey }) {
  const { t, i18n } = useTranslation();
  const today = useClock((now) => localDayNumber(now, deviceOffsetAt));
  const week = weekStrip(journey, today, deviceOffsetAt);
  return (
    <View accessible accessibilityLabel={spokenWeek(t, week)} style={styles.strip}>
      {week.map(({ day, status }) => (
        <View key={day} style={styles.day}>
          <View style={[styles.bar, BAR_STYLES[status]]} />
          <Text
            style={[
              typography.weekdayInitial,
              status === 'before-start' && styles.beforeStartInitial,
            ]}
          >
            {weekdayInitial(i18n.language, day)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    gap: spacing.s,
  },
  day: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.s,
  },
  bar: {
    alignSelf: 'stretch',
    height: sizes.weekBarHeight,
    borderRadius: sizes.weekBarHeight / 2,
  },
  clean: {
    backgroundColor: colors.accent,
  },
  today: {
    backgroundColor: colors.accent,
    opacity: 0.5,
  },
  lapse: {
    backgroundColor: colors.separator,
  },
  // No bar, but its slot stays so that every initial sits on the same line.
  beforeStart: {
    backgroundColor: 'transparent',
  },
  beforeStartInitial: {
    color: colors.locked,
  },
});

const BAR_STYLES: Record<WeekDayStatus, ViewStyle> = {
  clean: styles.clean,
  today: styles.today,
  lapse: styles.lapse,
  'before-start': styles.beforeStart,
};

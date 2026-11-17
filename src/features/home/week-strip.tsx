import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Journey } from '@/domain/journey';
import { localDayNumber } from '@/domain/local-time';
import { weekStrip, type WeekDayStatus } from '@/domain/week';
import { useClock } from '@/features/clock/clock-context';
import { spokenWeek, weekdayInitial } from '@/features/home/labels';
import { deviceOffsetAt } from '@/features/shared/device-time';
import { CheckIcon } from '@/ui/icons/check-icon';
import { colors, sizes, spacing, typography } from '@/ui/theme';

// The selector returns the local day, a number, so the strip re-renders once a day.
// The selector returns the local day, a number, so the strip re-renders once a day.
export function WeekStrip({ journey }: { journey: Journey }) {
  const { t, i18n } = useTranslation();
  const today = useClock((now) => localDayNumber(now, deviceOffsetAt));
  const week = weekStrip(journey, today, deviceOffsetAt);
  return (
    <View accessible accessibilityLabel={spokenWeek(t, week)} style={styles.strip}>
      {week.map(({ day, status }) => (
        <View key={day} style={styles.day}>
          <View style={[styles.circle, CIRCLE_STYLES[status]]}>
            {status === 'clean' && <CheckIcon color={colors.onAccent} size={16} />}
          </View>
          <Text style={[typography.weekdayInitial, INITIAL_STYLES[status]]}>
            {weekdayInitial(i18n.language, day)}
          </Text>
        </View>
      ))}
    </View>
  );
}

// A clean day is a filled circle with a check, today a bright ring. A day with a lapse looks like
// a day before the start, a faint ring: the strip never uses red or crosses.
const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  day: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.s,
  },
  circle: {
    width: sizes.weekDay,
    height: sizes.weekDay,
    borderRadius: sizes.weekDay / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clean: {
    backgroundColor: colors.accent,
  },
  today: {
    borderWidth: sizes.weekDayToday,
    borderColor: colors.text,
  },
  faint: {
    borderWidth: sizes.weekDayRing,
    borderColor: colors.separator,
  },
  todayInitial: {
    color: colors.text,
  },
  beforeStartInitial: {
    color: colors.muted,
  },
});

const CIRCLE_STYLES: Record<WeekDayStatus, ViewStyle> = {
  clean: styles.clean,
  today: styles.today,
  lapse: styles.faint,
  'before-start': styles.faint,
};

const INITIAL_STYLES: Record<WeekDayStatus, TextStyle | null> = {
  clean: null,
  today: styles.todayInitial,
  lapse: null,
  'before-start': styles.beforeStartInitial,
};

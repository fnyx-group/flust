import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  addMonths,
  monthGrid,
  utcToLocal,
  type UtcOffsetAt,
  type Weekday,
} from '@/domain/local-time';
import { isDaySelectable, selectDay, type StartBounds } from '@/domain/start-point';
import type { Timestamp } from '@/domain/time';
import {
  formatFullDate,
  formatMonth,
  formatWeekdays,
} from '@/features/onboarding/start-picker/format';
import { IconButton } from '@/ui/icon-button';
import { BackIcon } from '@/ui/icons/back-icon';
import { ForwardIcon } from '@/ui/icons/forward-icon';
import { colors, fonts, radii, sizes, spacing, typography } from '@/ui/theme';

type CalendarProps = {
  selected: Timestamp;
  bounds: StartBounds;
  offsetAt: UtcOffsetAt;
  firstWeekday: Weekday;
  onSelect: (at: Timestamp) => void;
};

type Month = { year: number; month: number };

export function Calendar({ selected, bounds, offsetAt, firstWeekday, onSelect }: CalendarProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const local = utcToLocal(selected, offsetAt);
  const selectedMonth = { year: local.year, month: local.month };
  const [visible, setVisible] = useState<Month>(selectedMonth);
  // When the steppers move the selection into another month, the calendar follows it; browsing
  // other months with the arrows is left alone until then.
  const [followed, setFollowed] = useState(monthIndex(selectedMonth));
  if (monthIndex(selectedMonth) !== followed) {
    setFollowed(monthIndex(selectedMonth));
    setVisible(selectedMonth);
  }
  const first = utcToLocal(bounds.min, offsetAt);
  const last = utcToLocal(bounds.max, offsetAt);
  const canGoBack = monthIndex(visible) > monthIndex(first);
  const canGoForward = monthIndex(visible) < monthIndex(last);
  const weeks = chunk(monthGrid(visible.year, visible.month, firstWeekday), 7);

  return (
    <View style={styles.calendar}>
      <View style={styles.header}>
        <IconButton
          accessibilityLabel={t('onboarding.start.picker.previousMonth')}
          disabled={!canGoBack}
          onPress={() => setVisible(addMonths(visible, -1))}
        >
          <BackIcon color={colors.text} size={20} />
        </IconButton>
        <Text accessibilityRole="header" style={styles.month}>
          {formatMonth(language, visible.year, visible.month)}
        </Text>
        <IconButton
          accessibilityLabel={t('onboarding.start.picker.nextMonth')}
          disabled={!canGoForward}
          onPress={() => setVisible(addMonths(visible, 1))}
        >
          <ForwardIcon color={colors.text} size={20} />
        </IconButton>
      </View>
      <View
        style={styles.week}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {formatWeekdays(language, firstWeekday).map((name, index) => (
          <Text key={index} style={styles.weekday}>
            {name}
          </Text>
        ))}
      </View>
      {weeks.map((week, row) => (
        <View key={row} style={styles.week}>
          {week.map((day, column) => {
            if (day === null) return <View key={column} style={styles.cell} />;
            const date = { ...visible, day };
            const isSelected =
              local.year === date.year && local.month === date.month && local.day === day;
            const enabled = isDaySelectable(date, offsetAt, bounds);
            return (
              <Pressable
                key={column}
                accessibilityRole="button"
                accessibilityLabel={formatFullDate(language, date)}
                accessibilityState={{ selected: isSelected, disabled: !enabled }}
                disabled={!enabled}
                onPress={() => onSelect(selectDay(selected, date, offsetAt, bounds))}
                style={styles.cell}
              >
                <View style={[styles.day, isSelected && styles.selectedDay]}>
                  <Text
                    style={[
                      styles.dayLabel,
                      !enabled && styles.disabledLabel,
                      isSelected && styles.selectedLabel,
                    ]}
                  >
                    {day}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function monthIndex({ year, month }: Month): number {
  return year * 12 + month;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );
}

const styles = StyleSheet.create({
  calendar: {
    gap: spacing.xs,
    padding: spacing.m,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.s,
  },
  month: {
    ...typography.row,
    flex: 1,
    textAlign: 'center',
    color: colors.text,
  },
  week: {
    flexDirection: 'row',
  },
  weekday: {
    ...typography.label,
    flex: 1,
    textAlign: 'center',
  },
  cell: {
    flex: 1,
    minHeight: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Grows with the text size instead of clipping the day number.
  day: {
    minWidth: sizes.touchTarget - 4,
    minHeight: sizes.touchTarget - 4,
    aspectRatio: 1,
    paddingHorizontal: spacing.xxs,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDay: {
    backgroundColor: colors.accent,
  },
  dayLabel: {
    ...typography.calendarDay,
    color: colors.text,
  },
  disabledLabel: {
    color: colors.locked,
  },
  selectedLabel: {
    fontFamily: fonts.numberSemiBold,
    color: colors.onAccent,
  },
});

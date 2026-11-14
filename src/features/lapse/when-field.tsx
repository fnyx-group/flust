import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { utcToLocal } from '@/domain/local-time';
import type { TimeBounds } from '@/domain/start-point';
import type { Timestamp } from '@/domain/time';
import { deviceCalendar, deviceOffsetAt } from '@/features/shared/device-time';
import { Calendar } from '@/features/shared/time-picker/calendar';
import { formatDateTime } from '@/features/shared/time-picker/format';
import { TimeSteppers } from '@/features/shared/time-picker/time-steppers';
import { SegmentedControl } from '@/ui/segmented-control';
import { colors, spacing, typography } from '@/ui/theme';

type WhenFieldProps = {
  // Null for now.
  earlier: Timestamp | null;
  // Null while no earlier time is possible: only now can be chosen.
  bounds: TimeBounds | null;
  onChooseNow: () => void;
  onChooseEarlier: () => void;
  onSelect: (at: Timestamp) => void;
};

// The picker of the onboarding's start step, bounded by the start of the streak that just ended.
export function WhenField({
  earlier,
  bounds,
  onChooseNow,
  onChooseEarlier,
  onSelect,
}: WhenFieldProps) {
  const { t, i18n } = useTranslation();
  const [{ firstWeekday, hour12 }] = useState(deviceCalendar);
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{t('lapse.when')}</Text>
      {bounds === null && <Text style={styles.selected}>{t('lapse.now')}</Text>}
      {bounds !== null && (
        <SegmentedControl
          accessibilityLabel={t('lapse.when')}
          options={[
            { key: 'now', label: t('lapse.now') },
            { key: 'earlier', label: t('lapse.earlier') },
          ]}
          selected={earlier === null ? 'now' : 'earlier'}
          onSelect={(key) => (key === 'now' ? onChooseNow() : onChooseEarlier())}
        />
      )}
      {earlier !== null && bounds !== null && (
        <>
          <Text accessibilityLiveRegion="polite" style={styles.selected}>
            {t('lapse.selected', {
              date: formatDateTime(i18n.language, utcToLocal(earlier, deviceOffsetAt), hour12),
            })}
          </Text>
          <Calendar
            selected={earlier}
            bounds={bounds}
            offsetAt={deviceOffsetAt}
            firstWeekday={firstWeekday}
            onSelect={onSelect}
          />
          <TimeSteppers
            selected={earlier}
            bounds={bounds}
            offsetAt={deviceOffsetAt}
            hour12={hour12}
            onSelect={onSelect}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.m,
  },
  label: {
    ...typography.label,
    paddingHorizontal: spacing.xs,
  },
  selected: {
    ...typography.row,
    color: colors.text,
  },
});

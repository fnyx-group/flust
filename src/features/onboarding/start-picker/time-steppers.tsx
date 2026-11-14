import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { utcToLocal, type UtcOffsetAt } from '@/domain/local-time';
import { stepHour, stepMinute, type StartBounds } from '@/domain/start-point';
import type { Timestamp } from '@/domain/time';
import { formatHour, formatMinute } from '@/features/onboarding/start-picker/format';
import { Stepper } from '@/ui/stepper';
import { spacing } from '@/ui/theme';

type TimeSteppersProps = {
  selected: Timestamp;
  bounds: StartBounds;
  offsetAt: UtcOffsetAt;
  hour12: boolean;
  onSelect: (at: Timestamp) => void;
};

export function TimeSteppers({ selected, bounds, offsetAt, hour12, onSelect }: TimeSteppersProps) {
  const { t, i18n } = useTranslation();
  const { hour, minute } = utcToLocal(selected, offsetAt);
  const earlierHour = stepHour(selected, -1, bounds);
  const laterHour = stepHour(selected, 1, bounds);
  const earlierMinute = stepMinute(selected, -1, bounds);
  const laterMinute = stepMinute(selected, 1, bounds);

  return (
    <View style={styles.row}>
      <Stepper
        label={t('onboarding.start.picker.hour')}
        value={formatHour(i18n.language, hour, hour12)}
        decrementLabel={t('onboarding.start.picker.earlierHour')}
        incrementLabel={t('onboarding.start.picker.laterHour')}
        canDecrement={earlierHour !== selected}
        canIncrement={laterHour !== selected}
        onDecrement={() => onSelect(earlierHour)}
        onIncrement={() => onSelect(laterHour)}
      />
      <Stepper
        label={t('onboarding.start.picker.minute')}
        value={formatMinute(minute)}
        decrementLabel={t('onboarding.start.picker.earlierMinute')}
        incrementLabel={t('onboarding.start.picker.laterMinute')}
        canDecrement={earlierMinute !== selected}
        canIncrement={laterMinute !== selected}
        onDecrement={() => onSelect(earlierMinute)}
        onIncrement={() => onSelect(laterMinute)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // With large text the two steppers no longer fit side by side, and stack.
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.m,
  },
});

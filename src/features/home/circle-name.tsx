import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Journey } from '@/domain/journey';
import { rankStanding, type RankId } from '@/domain/ranks';
import { useClock } from '@/features/clock/clock-context';
import { sameFields } from '@/features/clock/minute-clock';
import { headerCircle } from '@/features/home/labels';
import { circleTextColors, colors, typography } from '@/ui/theme';

type CircleNameProps = { journey: Journey; unlockedRanks: readonly RankId[] };

// The circle of the current rank in its color, or "First day" before it, in the home header.
export function CircleName({ journey, unlockedRanks }: CircleNameProps) {
  const { t } = useTranslation();
  const standing = useClock((now) => rankStanding(journey, unlockedRanks, now), sameFields);
  const { text, circle } = headerCircle(t, standing);
  const color = circle === null ? colors.textSecondary : circleTextColors[circle];
  return <Text style={[styles.name, { color }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  name: {
    ...typography.row,
    flexShrink: 1,
    textAlign: 'right',
  },
});

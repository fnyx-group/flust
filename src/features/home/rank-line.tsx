import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Journey } from '@/domain/journey';
import { rankStanding, type RankId } from '@/domain/ranks';
import { useClock } from '@/features/clock/clock-context';
import { sameFields } from '@/features/clock/minute-clock';
import { rankBadgeText } from '@/features/home/labels';
import { RankEmblem } from '@/ui/rank-emblem';
import { colors, pressedOpacity, sizes, spacing, typography } from '@/ui/theme';

type RankLineProps = {
  journey: Journey;
  unlockedRanks: readonly RankId[];
};

// Ranks reached here are not stored: the unlock screen stores a rank when it shows it, so that
// unlocked and announced stay the same thing. Until then the total alone gives the right rank.
// With a rank, the standing only changes once a day, so ticks in between do not re-render.
// The parts wrap under each other, still centered, when large text makes the line too long.
export function RankLine({ journey, unlockedRanks }: RankLineProps) {
  const { t } = useTranslation();
  const standing = useClock((now) => rankStanding(journey, unlockedRanks, now), sameFields);
  const text = rankBadgeText(t, standing);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text.spokenLabel}
      accessibilityHint={t('home.rank.hint')}
      onPress={() => router.navigate('/ranks')}
      style={({ pressed }) => [styles.line, pressed && styles.pressed]}
    >
      <RankEmblem
        circle={text.rank.circle}
        tier={text.rank.tier}
        unlocked={text.unlocked}
        size={sizes.rankLineEmblem}
      />
      <Text style={styles.name}>{text.name}</Text>
      <Text style={styles.detail}>{text.detail}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  line: {
    minHeight: sizes.touchTarget,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: spacing.m,
    rowGap: spacing.xs,
  },
  pressed: {
    opacity: pressedOpacity,
  },
  name: {
    ...typography.rankLineName,
    color: colors.text,
  },
  detail: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
  },
});

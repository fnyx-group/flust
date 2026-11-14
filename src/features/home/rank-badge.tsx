import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Journey } from '@/domain/journey';
import { rankStanding, type RankId } from '@/domain/ranks';
import { useClock } from '@/features/clock/clock-context';
import { rankBadgeText } from '@/features/home/labels';
import { sameFields } from '@/features/clock/minute-clock';
import { ProgressRing } from '@/ui/progress-ring';
import { RankEmblem } from '@/ui/rank-emblem';
import { colors, pressedOpacity, radii, sizes, spacing, typography } from '@/ui/theme';

type RankBadgeProps = {
  journey: Journey;
  unlockedRanks: readonly RankId[];
};

// Ranks reached here are not stored: the unlock screen stores a rank when it shows it, so that
// unlocked and announced stay the same thing. Until then the total alone gives the right rank.
// With a rank, the standing only changes once a day, so ticks in between do not re-render.
export function RankBadge({ journey, unlockedRanks }: RankBadgeProps) {
  const { t } = useTranslation();
  const standing = useClock((now) => rankStanding(journey, unlockedRanks, now), sameFields);
  const text = rankBadgeText(t, standing);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text.spokenLabel}
      accessibilityHint={t('home.rank.hint')}
      onPress={() => router.navigate('/ranks')}
      style={({ pressed }) => [styles.badge, pressed && styles.pressed]}
    >
      <ProgressRing
        fraction={standing.fraction}
        size={sizes.badgeRing}
        strokeWidth={sizes.badgeRingStroke}
      >
        <RankEmblem
          circle={text.rank.circle}
          tier={text.rank.tier}
          unlocked={text.unlocked}
          size={sizes.badgeEmblem}
        />
      </ProgressRing>
      <View style={styles.texts}>
        <Text style={styles.name}>{text.name}</Text>
        <Text style={typography.badgeDetail}>{text.detail}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.m,
  },
  pressed: {
    opacity: pressedOpacity,
  },
  texts: {
    flexShrink: 1,
    gap: spacing.xxs,
  },
  name: {
    ...typography.badgeName,
    color: colors.text,
  },
});

import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Journey } from '@/domain/journey';
import { rankStanding, type RankId } from '@/domain/ranks';
import { useClock } from '@/features/clock/clock-context';
import { sameFields } from '@/features/clock/minute-clock';
import { rankBadgeText } from '@/features/home/labels';
import { ForwardIcon } from '@/ui/icons/forward-icon';
import { RankEmblem } from '@/ui/rank-emblem';
import { colors, pressedOpacity, radii, sizes, spacing, typography } from '@/ui/theme';

type RankCardProps = {
  journey: Journey;
  unlockedRanks: readonly RankId[];
};

// Ranks reached here are not stored: the unlock screen stores a rank when it shows it, so that
// unlocked and announced stay the same thing. Until then the total alone gives the right rank.
// With a rank, the standing only changes once a day, so ticks in between do not re-render.
export function RankCard({ journey, unlockedRanks }: RankCardProps) {
  const { t } = useTranslation();
  const standing = useClock((now) => rankStanding(journey, unlockedRanks, now), sameFields);
  const text = rankBadgeText(t, standing);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text.spokenLabel}
      accessibilityHint={t('home.rank.hint')}
      onPress={() => router.navigate('/ranks')}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <RankEmblem
        circle={text.rank.circle}
        tier={text.rank.tier}
        unlocked={text.unlocked}
        size={sizes.rankCardEmblem}
      />
      <View style={styles.texts}>
        <Text style={styles.name}>{text.name}</Text>
        <Text style={styles.detail}>{text.detail}</Text>
      </View>
      <ForwardIcon color={colors.textSecondary} size={sizes.icon} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.l,
    padding: spacing.card,
    borderRadius: radii.cardLarge,
    backgroundColor: colors.accentSurface,
  },
  pressed: {
    opacity: pressedOpacity,
  },
  texts: {
    flex: 1,
    gap: spacing.xxs,
  },
  name: {
    ...typography.rankCardName,
    color: colors.text,
  },
  detail: {
    ...typography.body,
    color: colors.textSecondary,
  },
});

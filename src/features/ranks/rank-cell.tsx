import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { RankCell as Cell } from '@/domain/ranks';
import { rankCellText } from '@/features/ranks/labels';
import { RankEmblem } from '@/ui/rank-emblem';
import { RankStars } from '@/ui/rank-stars';
import { colors, radii, sizes, spacing, typography } from '@/ui/theme';

export function RankCell({ cell }: { cell: Cell }) {
  const { t } = useTranslation();
  const text = rankCellText(t, cell);
  const unlocked = cell.state === 'unlocked' || cell.state === 'current';
  return (
    <View
      accessible
      accessibilityLabel={text.spokenLabel}
      style={[styles.cell, cell.state === 'current' && styles.current]}
    >
      <RankEmblem
        circle={cell.rank.circle}
        tier={cell.rank.tier}
        unlocked={unlocked}
        size={sizes.gridEmblem}
      />
      <Text style={[styles.name, NAME_COLORS[cell.state]]}>{text.name}</Text>
      <RankStars circle={cell.rank.circle} color={unlocked ? colors.text : colors.locked} />
      <Text style={styles.days}>{t('units.day', { count: cell.rank.threshold })}</Text>
    </View>
  );
}

// The outline is always drawn, transparent except on the current rank, so cells keep one size.
const styles = StyleSheet.create({
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.s,
    paddingVertical: spacing.l,
    paddingHorizontal: spacing.s,
    borderRadius: radii.card,
    borderWidth: sizes.currentRankOutline,
    borderColor: colors.surface,
    backgroundColor: colors.surface,
  },
  current: {
    borderColor: colors.accent,
  },
  name: {
    ...typography.badgeName,
    textAlign: 'center',
  },
  days: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

const NAME_COLORS = StyleSheet.create({
  unlocked: { color: colors.text },
  current: { color: colors.text },
  next: { color: colors.textSecondary },
  locked: { color: colors.locked },
});

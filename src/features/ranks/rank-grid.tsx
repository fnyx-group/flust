import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Journey } from '@/domain/journey';
import { rankGrid, rankProgress, type RankCell as Cell, type RankId } from '@/domain/ranks';
import { totalCleanDays } from '@/domain/streak';
import { useClock } from '@/features/clock/clock-context';
import { circleGroups, romanNumeral } from '@/features/ranks/labels';
import { RankCell } from '@/features/ranks/rank-cell';
import { circleTextColors, colors, spacing, typography } from '@/ui/theme';
import { useLargeText } from '@/ui/use-large-text';

type RankGridProps = {
  journey: Journey;
  unlockedRanks: readonly RankId[];
};

// With large text, a rank name such as "Illuminé" no longer fits a third of the screen.
const COLUMNS = 3;
const COLUMNS_LARGE_TEXT = 2;

// The ranks in one group per circle. The selector returns the total, a number, so the grid
// re-renders once a day at most.
export function RankGrid({ journey, unlockedRanks }: RankGridProps) {
  const { t } = useTranslation();
  const total = useClock((now) => totalCleanDays(journey, now));
  const columns = useLargeText() ? COLUMNS_LARGE_TEXT : COLUMNS;
  const groups = circleGroups(rankGrid(rankProgress(unlockedRanks, total)));
  return (
    <View style={styles.groups}>
      {groups.map(({ circle, cells }) => (
        <View key={circle} style={styles.group}>
          <View accessibilityRole="header" accessible style={styles.header}>
            <Text style={[styles.headerText, styles.numeral]}>{romanNumeral(circle)}</Text>
            <Text style={[styles.headerText, { color: circleTextColors[circle] }]}>
              {t(`ranks.circles.${circle}`)}
            </Text>
          </View>
          {chunk(cells, columns).map((row) => (
            <View key={row[0]?.rank.id} style={styles.row}>
              {row.map((cell) => (
                <RankCell key={cell.rank.id} cell={cell} />
              ))}
              {/* Empty slots keep the cells of a short row at the width of a full one. */}
              {Array.from({ length: columns - row.length }, (_, index) => (
                <View key={`empty-${index}`} style={styles.empty} />
              ))}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function chunk(cells: readonly Cell[], size: number): Cell[][] {
  return Array.from({ length: Math.ceil(cells.length / size) }, (_, index) =>
    cells.slice(index * size, index * size + size),
  );
}

const styles = StyleSheet.create({
  groups: {
    gap: spacing.xl,
  },
  group: {
    gap: spacing.m,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.s,
  },
  headerText: {
    ...typography.sectionLabel,
    fontSize: 16,
  },
  numeral: {
    color: colors.muted,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.s,
  },
  empty: {
    flex: 1,
  },
});

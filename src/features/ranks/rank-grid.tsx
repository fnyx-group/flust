import { StyleSheet, View } from 'react-native';

import type { Journey } from '@/domain/journey';
import { rankGrid, rankProgress, type RankCell as Cell, type RankId } from '@/domain/ranks';
import { totalCleanDays } from '@/domain/streak';
import { useClock } from '@/features/clock/clock-context';
import { RankCell } from '@/features/ranks/rank-cell';
import { spacing } from '@/ui/theme';
import { useLargeText } from '@/ui/use-large-text';

type RankGridProps = {
  journey: Journey;
  unlockedRanks: readonly RankId[];
};

// With large text, a rank name such as "Illuminé" no longer fits a third of the screen.
const COLUMNS = 3;
const COLUMNS_LARGE_TEXT = 2;

// The selector returns the total, a number, so the grid re-renders once a day at most.
export function RankGrid({ journey, unlockedRanks }: RankGridProps) {
  const total = useClock((now) => totalCleanDays(journey, now));
  const columns = useLargeText() ? COLUMNS_LARGE_TEXT : COLUMNS;
  const rows = chunk(rankGrid(rankProgress(unlockedRanks, total)), columns);
  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row[0]?.rank.id} style={styles.row}>
          {row.map((cell) => (
            <RankCell key={cell.rank.id} cell={cell} />
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
  grid: {
    gap: spacing.s,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.s,
  },
});

import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Journey } from '@/domain/journey';
import type { RankId } from '@/domain/ranks';
import { streakStart } from '@/domain/streak';
import { ClockContext } from '@/features/clock/clock-context';
import { createMinuteClock } from '@/features/clock/minute-clock';
import { nativeClockDeps } from '@/features/clock/native-clock';
import { CurrentRankCard } from '@/features/ranks/current-rank-card';
import { RankGrid } from '@/features/ranks/rank-grid';
import { useSession } from '@/features/session/session-context';
import { Screen } from '@/ui/screen';
import { ScreenTitle } from '@/ui/screen-title';
import { ScrollView } from '@/ui/scroll-view';
import { colors, spacing, typography } from '@/ui/theme';

export function RanksScreen() {
  const { journey, unlockedRanks } = useSession();
  // The tabs are only reachable once a journey exists.
  if (journey === null) return null;
  return <Ranks journey={journey} unlockedRanks={unlockedRanks} />;
}

type RanksProps = {
  journey: Journey;
  unlockedRanks: readonly RankId[];
};

// The tab has its own clock, so that the time left to the first rank and the grid stay current.
function Ranks({ journey, unlockedRanks }: RanksProps) {
  const { t } = useTranslation();
  const anchor = streakStart(journey);
  const clock = useMemo(() => createMinuteClock(anchor, nativeClockDeps), [anchor]);
  return (
    <Screen>
      <ClockContext value={clock}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ScreenTitle>{t('tabs.ranks')}</ScreenTitle>
          <CurrentRankCard journey={journey} unlockedRanks={unlockedRanks} />
          <Text style={styles.rule}>{t('ranks.screen.rule')}</Text>
          <RankGrid journey={journey} unlockedRanks={unlockedRanks} />
        </ScrollView>
      </ClockContext>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
  },
  rule: {
    ...typography.bodyLarge,
    lineHeight: 24,
    color: colors.textSecondary,
  },
});

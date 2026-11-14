import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Journey } from '@/domain/journey';
import type { RankId } from '@/domain/ranks';
import { streakStart } from '@/domain/streak';
import { ClockContext } from '@/features/clock/clock-context';
import { createMinuteClock } from '@/features/clock/minute-clock';
import { nativeClockDeps } from '@/features/clock/native-clock';
import { DailyQuote } from '@/features/home/daily-quote';
import { RankBadge } from '@/features/home/rank-badge';
import { StreakCounter } from '@/features/home/streak-counter';
import { WeekStrip } from '@/features/home/week-strip';
import { useRankUnlockTrigger } from '@/features/ranks/use-rank-unlock-trigger';
import { useSession } from '@/features/session/session-context';
import { BrandHeader } from '@/ui/brand/brand-header';
import { Button } from '@/ui/button';
import { Screen } from '@/ui/screen';
import { ScrollView } from '@/ui/scroll-view';
import { spacing } from '@/ui/theme';

export function HomeScreen() {
  const { journey, unlockedRanks } = useSession();
  // The tabs are only reachable once a journey exists.
  if (journey === null) return null;
  return <Home journey={journey} unlockedRanks={unlockedRanks} />;
}

type HomeProps = {
  journey: Journey;
  unlockedRanks: readonly RankId[];
};

// This component never reads the clock: only the badge, the counter, the week strip and the quote
// subscribe to it, so a tick re-renders them and nothing else. A lapse moves the streak start,
// which the clock's ticks are aligned to, so it gets a new clock.
function Home({ journey, unlockedRanks }: HomeProps) {
  const { t } = useTranslation();
  const anchor = streakStart(journey);
  const clock = useMemo(() => createMinuteClock(anchor, nativeClockDeps), [anchor]);
  return (
    <Screen>
      <ClockContext value={clock}>
        <RankUnlockTrigger journey={journey} unlockedRanks={unlockedRanks} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <BrandHeader />
            <RankBadge journey={journey} unlockedRanks={unlockedRanks} />
          </View>
          <View style={styles.middle}>
            <View style={styles.hero}>
              <StreakCounter journey={journey} />
              <WeekStrip journey={journey} />
            </View>
            <View style={styles.quote}>
              <DailyQuote start={journey.start} />
            </View>
          </View>
          <Button label={t('home.urgeButton')} onPress={() => router.push('/emergency')} />
        </ScrollView>
      </ClockContext>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  // flexGrow lets the middle take the free height when everything fits, and the screen scroll when
  // large text makes it taller.
  content: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.m,
  },
  // The counter, the week strip and the quote are one block: the free space goes above and below
  // it, never between its parts. The padding is the least space left around it.
  middle: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  hero: {
    gap: spacing.xl,
  },
  quote: {
    marginTop: spacing.xxxl,
  },
});

// A component of its own, so that the clock ticks it subscribes to re-render nothing else.
function RankUnlockTrigger({ journey, unlockedRanks }: HomeProps) {
  useRankUnlockTrigger(journey, unlockedRanks);
  return null;
}

import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Journey } from '@/domain/journey';
import type { LapseRecord } from '@/domain/lapse';
import type { RankId } from '@/domain/ranks';
import { streakStart } from '@/domain/streak';
import { ClockContext } from '@/features/clock/clock-context';
import { createMinuteClock } from '@/features/clock/minute-clock';
import { nativeClockDeps } from '@/features/clock/native-clock';
import { CheckInLine } from '@/features/home/check-in-line';
import { CircleName } from '@/features/home/circle-name';
import { DailyQuote } from '@/features/home/daily-quote';
import { SupportLine, UndoLine } from '@/features/home/lapse-lines';
import { LowMoodCard } from '@/features/home/low-mood-card';
import { RankCard } from '@/features/home/rank-card';
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
  const { journey, unlockedRanks, latestLapse } = useSession();
  // The tabs are only reachable once a journey exists.
  if (journey === null) return null;
  return <Home journey={journey} unlockedRanks={unlockedRanks} latestLapse={latestLapse} />;
}

type HomeProps = {
  journey: Journey;
  unlockedRanks: readonly RankId[];
  latestLapse: LapseRecord | null;
};

// This component never reads the clock: only the circle name, the counter, the rank card, the
// week strip, the quote, the check-in line and the low mood card subscribe to it, so a tick re-renders them and nothing
// else. A lapse moves the streak start, which the clock's ticks are aligned to, so it gets a new
// clock.
function Home({ journey, unlockedRanks, latestLapse }: HomeProps) {
  const { t } = useTranslation();
  const anchor = streakStart(journey);
  const clock = useMemo(() => createMinuteClock(anchor, nativeClockDeps), [anchor]);
  return (
    <Screen>
      <ClockContext value={clock}>
        <RankUnlockTrigger
          journey={journey}
          unlockedRanks={unlockedRanks}
          latestLapse={latestLapse}
        />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <BrandHeader />
            <CircleName journey={journey} unlockedRanks={unlockedRanks} />
          </View>
          <View style={styles.middle}>
            <StreakCounter journey={journey} unlockedRanks={unlockedRanks} />
            <View style={styles.progress}>
              <RankCard journey={journey} unlockedRanks={unlockedRanks} />
              <WeekStrip journey={journey} />
            </View>
            <View style={styles.quote}>
              <DailyQuote start={journey.start} />
              <CheckInLine />
            </View>
          </View>
          <View style={styles.notices}>
            <LowMoodCard />
            <SupportLine latestLapse={latestLapse} />
          </View>
        </ScrollView>
        <View style={styles.actions}>
          <Button label={t('home.urgeButton')} onPress={() => router.push('/emergency')} />
          <Button
            variant="plain"
            label={t('home.lapse.link')}
            onPress={() => router.push('/lapse')}
          />
          <UndoLine journey={journey} latestLapse={latestLapse} />
        </View>
      </ClockContext>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  // flexGrow lets the middle take the free height when everything fits, and the content scroll
  // above the buttons when large text makes it taller.
  content: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.m,
  },
  // The ring, the rank card, the week strip and the quote are one block: the free space goes
  // above and below it, never between its parts. The padding is the least space left around it.
  middle: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.xl,
  },
  progress: {
    gap: spacing.l,
  },
  quote: {
    gap: spacing.xs,
  },
  notices: {
    gap: spacing.s,
  },
  // Outside the scroll view, so the urge button is always on screen, whatever the text size.
  actions: {
    gap: spacing.s,
    paddingTop: spacing.m,
  },
});

// A component of its own, so that the clock ticks it subscribes to re-render nothing else.
function RankUnlockTrigger({ journey, unlockedRanks, latestLapse }: HomeProps) {
  useRankUnlockTrigger(journey, unlockedRanks, latestLapse);
  return null;
}

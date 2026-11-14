import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Journey } from '@/domain/journey';
import type { RankId } from '@/domain/ranks';
import { streakStart } from '@/domain/streak';
import { ClockContext } from '@/features/home/clock-context';
import { DailyQuote } from '@/features/home/daily-quote';
import { createMinuteClock } from '@/features/home/minute-clock';
import { nativeClockDeps } from '@/features/home/native-clock';
import { RankCard } from '@/features/home/rank-card';
import { StreakCounter } from '@/features/home/streak-counter';
import { useSession } from '@/features/session/session-context';
import { BrandHeader } from '@/ui/brand/brand-header';
import { Button } from '@/ui/button';
import { Screen } from '@/ui/screen';
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

// This component never reads the clock: only the counter, the rank card and the quote subscribe
// to it, so a tick re-renders them and nothing else. A lapse moves the streak start, which the
// clock's ticks are aligned to, so it gets a new clock.
function Home({ journey, unlockedRanks }: HomeProps) {
  const { t } = useTranslation();
  const anchor = streakStart(journey);
  const clock = useMemo(() => createMinuteClock(anchor, nativeClockDeps), [anchor]);
  return (
    <Screen>
      <ClockContext value={clock}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <BrandHeader />
          <View style={styles.counter}>
            <StreakCounter journey={journey} />
          </View>
          <RankCard journey={journey} unlockedRanks={unlockedRanks} />
          <View style={styles.quote}>
            <DailyQuote start={journey.start} />
          </View>
          <View style={styles.action}>
            <Button label={t('home.urgeButton')} onPress={() => router.push('/emergency')} />
          </View>
        </ScrollView>
      </ClockContext>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  // flexGrow keeps the button at the bottom when everything fits, and lets the screen scroll when
  // large text makes it taller.
  content: {
    flexGrow: 1,
  },
  counter: {
    marginTop: spacing.xxxl,
    marginBottom: spacing.xl,
  },
  quote: {
    marginTop: spacing.xxl,
  },
  action: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingTop: spacing.xxl,
  },
});

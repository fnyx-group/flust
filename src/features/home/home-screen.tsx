import { useRouter } from 'expo-router';
import { useMemo, useState, type PropsWithChildren } from 'react';
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Journey } from '@/domain/journey';
import type { LapseRecord } from '@/domain/lapse';
import type { RankId } from '@/domain/ranks';
import { filterView, isFilterInactive } from '@/domain/filter-state';
import { streakStart } from '@/domain/streak';
import { ClockContext } from '@/features/clock/clock-context';
import { createMinuteClock } from '@/features/clock/minute-clock';
import { useFilterStatus } from '@/features/filter/use-filter-status';
import { nativeClockDeps } from '@/features/clock/native-clock';
import { CheckInLine } from '@/features/home/check-in-line';
import { CircleName } from '@/features/home/circle-name';
import { FilterChip } from '@/features/home/filter-chip';
import { DailyQuote } from '@/features/home/daily-quote';
import { fitHome, homeSpacing, type HomeFit } from '@/features/home/home-fit';
import { SupportLine, UndoLine } from '@/features/home/lapse-lines';
import { LowMoodCard } from '@/features/home/low-mood-card';
import { RankLine } from '@/features/home/rank-line';
import { StreakCounter } from '@/features/home/streak-counter';
import { useRankUnlockTrigger } from '@/features/ranks/use-rank-unlock-trigger';
import { useSession } from '@/features/session/session-context';
import { BrandHeader } from '@/ui/brand/brand-header';
import { Button } from '@/ui/button';
import { Screen } from '@/ui/screen';
import { ScrollView } from '@/ui/scroll-view';
import { sizes, spacing, streakRingSize } from '@/ui/theme';

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

// This component never reads the clock: only the circle name, the counter, the rank line, the
// quote, the check-in line and the low mood card subscribe to it, so a tick re-renders them and
// nothing else. A lapse moves the streak start, which the clock's ticks are aligned to, so it
// gets a new clock.
function Home({ journey, unlockedRanks, latestLapse }: HomeProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const anchor = streakStart(journey);
  const clock = useMemo(() => createMinuteClock(anchor, nativeClockDeps), [anchor]);
  const { width, fontScale } = useWindowDimensions();
  const ringMax = streakRingSize(width);
  const [measured, setMeasured] = useState<Measured>({});
  const measure = (part: MeasuredPart) => (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setMeasured((previous) =>
      previous[part] === height ? previous : { ...previous, [part]: height },
    );
  };
  const filterInactive = isFilterInactive(filterView(useFilterStatus().status));
  const fit = fitOf(measured, fontScale, ringMax);
  return (
    <Screen>
      <ClockContext value={clock}>
        <RankUnlockTrigger
          journey={journey}
          unlockedRanks={unlockedRanks}
          latestLapse={latestLapse}
        />
        <View style={styles.header}>
          <BrandHeader />
          {filterInactive ? (
            <FilterChip />
          ) : (
            <CircleName journey={journey} unlockedRanks={unlockedRanks} />
          )}
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, fit === null && styles.measuring]}
          showsVerticalScrollIndicator={false}
          onLayout={measure('available')}
        >
          <View style={styles.middle}>
            <StreakCounter
              journey={journey}
              unlockedRanks={unlockedRanks}
              ring={fit?.ring ?? ringMax}
            />
            <View onLayout={measure('rankLine')}>
              <RankLine journey={journey} unlockedRanks={unlockedRanks} />
            </View>
            <QuoteSlot shown={fit?.quote ?? true} onLayout={measure('quote')}>
              <DailyQuote start={journey.start} />
            </QuoteSlot>
          </View>
          <View style={styles.notices} onLayout={measure('notices')}>
            <LowMoodCard />
            <SupportLine latestLapse={latestLapse} />
          </View>
        </ScrollView>
        <View style={styles.actions}>
          <CheckInLine />
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

type MeasuredPart = 'available' | 'rankLine' | 'quote' | 'notices';

type Measured = Partial<Record<MeasuredPart, number>>;

// null until every part has been measured once.
function fitOf(measured: Measured, fontScale: number, ringMax: number): HomeFit | null {
  const { available, rankLine, quote, notices } = measured;
  if (
    available === undefined ||
    rankLine === undefined ||
    quote === undefined ||
    notices === undefined
  ) {
    return null;
  }
  return fitHome({
    available,
    fontScale,
    ringMax,
    heights: { rankLine, quote, notices },
  });
}

const styles = StyleSheet.create({
  // The same row as the screen titles of the other tabs.
  header: {
    minHeight: sizes.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.m,
  },
  scroll: {
    flex: 1,
  },
  // flexGrow lets the middle take the free height when everything fits. The content scrolls
  // above the buttons only when fitHome cannot make it fit, with large text.
  content: {
    flexGrow: 1,
  },
  // Unseen for the first layout, until the parts are measured, so a too tall first layout does
  // not flash.
  measuring: {
    opacity: 0,
  },
  // The ring, the rank line and the quote are one block: the free space goes above and below it,
  // never between its parts. The padding is the least space left around it.
  middle: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: homeSpacing.middleGap,
    paddingVertical: homeSpacing.middlePadding,
  },
  notices: {
    gap: spacing.s,
  },
  // Out of the flow, unseen and unreachable, at the width the quote would have.
  offstage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    opacity: 0,
    pointerEvents: 'none',
  },
  // Outside the scroll view, so the check-in line and the urge button are always on screen,
  // whatever the text size.
  actions: {
    gap: spacing.s,
    paddingTop: spacing.m,
  },
});

type QuoteSlotProps = { shown: boolean; onLayout: (event: LayoutChangeEvent) => void };

// A hidden quote stays laid out off the flow, so its height follows the quote of the day: a
// longer quote, or one with an author, gets the room it needs before it shows again.
function QuoteSlot({ shown, onLayout, children }: PropsWithChildren<QuoteSlotProps>) {
  return (
    <View
      onLayout={onLayout}
      importantForAccessibility={shown ? 'auto' : 'no-hide-descendants'}
      accessibilityElementsHidden={!shown}
      style={shown ? undefined : styles.offstage}
    >
      {children}
    </View>
  );
}

// A component of its own, so that the clock ticks it subscribes to re-render nothing else.
function RankUnlockTrigger({ journey, unlockedRanks, latestLapse }: HomeProps) {
  useRankUnlockTrigger(journey, unlockedRanks, latestLapse);
  return null;
}

import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { createJourney } from '@/domain/journey';
import { MS_PER_DAY } from '@/domain/time';
import { ClockContext } from '@/features/clock/clock-context';
import type { TickClock } from '@/features/clock/minute-clock';
import { StreakCounter } from '@/features/home/streak-counter';

const NOW = Date.UTC(2026, 10, 21, 12);
const clock: TickClock = { now: () => NOW, subscribe: () => () => undefined };
const created = createJourney(NOW - 5 * MS_PER_DAY, NOW);
if (!created.ok) throw new Error('The journey fixture is invalid.');
const journey = created.value;

const routes = {
  index: () => (
    <ClockContext value={clock}>
      <StreakCounter journey={journey} unlockedRanks={[]} ring={240} />
    </ClockContext>
  ),
  ranks: () => <Text>Ranks</Text>,
};

describe('StreakCounter', () => {
  // Android recreates the activity when the font size or display size changes: the new root
  // mounts before the old one unmounts, which unbinds expo-router's global router. A tap on the
  // counter then threw "The imperative router is unavailable before the first render has finished."
  it('still opens the ranks after a second root mounted and the first unmounted', async () => {
    const first = await renderRouter(routes);
    const second = await renderRouter(routes);
    await first.unmount();

    await fireEvent.press(second.getByRole('button'));

    expect(await screen.findByText('Ranks')).toBeOnTheScreen();
  });
});

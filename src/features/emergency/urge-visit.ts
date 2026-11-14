import type { UrgeRepository } from '@/data/urge-repository';
import type { Timestamp } from '@/domain/time';
import type { UrgeOutcome } from '@/domain/urge';

export type UrgeVisit = {
  // Only the first outcome counts: leaving through a button also removes the screen, which
  // reports it as closed afterwards.
  finish(outcome: UrgeOutcome, at: Timestamp): Promise<void>;
};

// The visit is stored as soon as the screen opens. Finishing waits for that write, so a quick
// exit still completes the right row. Failures are not shown: a statistic must never get in the
// way of someone going through an urge.
export function startUrgeVisit(
  urges: Pick<UrgeRepository, 'start' | 'finish'>,
  openedAt: Timestamp,
): UrgeVisit {
  const started = urges.start(openedAt);
  let finished = false;
  return {
    async finish(outcome, at) {
      if (finished) return;
      finished = true;
      const id = await started;
      if (id.ok) await urges.finish(id.value, at, outcome);
    },
  };
}

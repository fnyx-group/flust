import type { RankId } from '@/domain/ranks';

export type UnlockAnnouncerDeps = {
  persist(ids: readonly RankId[]): Promise<unknown>;
  addToSession(ids: readonly RankId[]): void;
};

export type UnlockAnnouncer = {
  // Returns true when the caller should show the unlock screen.
  announce(ids: readonly RankId[]): boolean;
};

// The set is updated synchronously, before React commits the new session, so a clock tick or a
// repeated effect in between finds the ranks already announced. A failed write is not retried:
// the ranks stay in the session for this run, and the next launch announces them again.
export function createUnlockAnnouncer(deps: UnlockAnnouncerDeps): UnlockAnnouncer {
  const announced = new Set<RankId>();
  return {
    announce(ids) {
      if (ids.every((id) => announced.has(id))) return false;
      for (const id of ids) announced.add(id);
      deps.addToSession(ids);
      void deps.persist(ids);
      return true;
    },
  };
}

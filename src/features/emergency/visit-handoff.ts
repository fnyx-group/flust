import type { UrgeVisit } from '@/features/emergency/urge-visit';

// Route params are strings, so a visit passed from the emergency screen to the lapse screen waits
// here under a key until the lapse screen ends it. Kept in memory only: a killed app leaves the
// visit without an outcome, like any visit cut short.
const handedOff = new Map<string, UrgeVisit>();
let lastKey = 0;

export function handOffVisit(visit: UrgeVisit): string {
  lastKey += 1;
  const key = String(lastKey);
  handedOff.set(key, {
    finish(outcome, at) {
      handedOff.delete(key);
      return visit.finish(outcome, at);
    },
  });
  return key;
}

// Reading leaves the visit in place, since React may run a state initializer twice.
export function handedOffVisit(key: unknown): UrgeVisit | null {
  return typeof key === 'string' ? (handedOff.get(key) ?? null) : null;
}

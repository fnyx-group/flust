import type { Database, Executor } from '@/data/database';
import { restoreJourney, type Journey } from '@/domain/journey';
import { err, ok, type Result } from '@/domain/result';

export type LoadJourneyError = 'storage-failed' | 'journey-corrupted';

export type JourneyRepository = {
  load(): Promise<Result<Journey | null, LoadJourneyError>>;
};

type StoredJourney = { start: unknown; lapses: unknown[] } | null;

export function createJourneyRepository(db: Database): JourneyRepository {
  return {
    async load() {
      let stored: StoredJourney;
      try {
        stored = await db.transaction(readJourney);
      } catch {
        return err('storage-failed');
      }
      if (stored === null) return ok(null);
      const { start, lapses } = stored;
      if (typeof start !== 'number' || !lapses.every((lapse) => typeof lapse === 'number')) {
        return err('journey-corrupted');
      }
      const journey = restoreJourney(start, lapses);
      return journey.ok ? journey : err('journey-corrupted');
    },
  };
}

async function readJourney(tx: Executor): Promise<StoredJourney> {
  const journeys = await tx.all('SELECT start_at FROM journey WHERE id = 1');
  const journey = journeys[0];
  if (journey === undefined) return null;
  const lapses = await tx.all('SELECT at FROM lapse ORDER BY at, id');
  return { start: journey.start_at, lapses: lapses.map((lapse) => lapse.at) };
}

// Fails if a journey already exists, so that starting one never replaces the user's history.
export async function insertJourney(tx: Executor, journey: Journey): Promise<void> {
  await tx.run('INSERT INTO journey (id, start_at) VALUES (1, ?)', [journey.start]);
  await writeLapses(tx, journey);
}

async function writeLapses(tx: Executor, journey: Journey): Promise<void> {
  for (const lapse of journey.lapses) {
    await tx.run('INSERT INTO lapse (at) VALUES (?)', [lapse]);
  }
}

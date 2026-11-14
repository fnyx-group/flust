import type { Database, Executor } from '@/data/database';
import { decodePlan, parseJson } from '@/data/json-codec';
import { deleteFirstPlan, readFirstPlan, writeFirstPlan } from '@/data/profile-repository';
import {
  hasDetails,
  planToRestore,
  type LapseDetails,
  type LapseRecord,
  type PlanChange,
} from '@/domain/lapse';
import { samePlan, type Plan } from '@/domain/onboarding';
import { err, ok, type Result } from '@/domain/result';
import { isValidTimestamp, type Timestamp } from '@/domain/time';

export type LapseStorageError = 'storage-failed';
export type UndoLapseError = LapseStorageError | 'lapse-not-found';

export type NewLapse = {
  readonly at: Timestamp;
  readonly recordedAt: Timestamp;
  // Null when the questions were skipped: nothing but the lapse is stored.
  readonly details: LapseDetails | null;
  // The plan chosen on the lapse screen, or null when it was left as it was. The plan it replaces
  // is read from storage, never taken from the screen.
  readonly plan: Plan | null;
};

export type LapseRepository = {
  record(lapse: NewLapse): Promise<Result<LapseRecord, LapseStorageError>>;
  undo(id: number): Promise<Result<void, UndoLapseError>>;
  latest(): Promise<Result<LapseRecord | null, LapseStorageError>>;
};

// Lapses are written and removed one row at a time, by id: rewriting them all would give them
// new ids and lose the details that point at them.
export function createLapseRepository(db: Database): LapseRepository {
  return {
    async record(lapse) {
      try {
        return ok(await db.transaction((tx) => insertLapse(tx, lapse)));
      } catch {
        return err('storage-failed');
      }
    },

    // One transaction: the plan the lapse changed comes back, or the plan it added goes, then its
    // detail and the lapse go.
    async undo(id) {
      try {
        const found = await db.transaction((tx) => deleteLapse(tx, id));
        return found ? ok(undefined) : err('lapse-not-found');
      } catch {
        return err('storage-failed');
      }
    },

    // The last lapse logged, by insertion order rather than by time, since a backdated lapse
    // logged now is the one an undo is about.
    async latest() {
      try {
        const rows = await db.all('SELECT id, at, recorded_at FROM lapse ORDER BY id DESC LIMIT 1');
        const row = rows[0];
        if (row === undefined) return ok(null);
        const { id, at, recorded_at: recordedAt } = row;
        if (typeof id !== 'number' || !isTimestamp(at)) return ok(null);
        return ok({ id, at, recordedAt: isTimestamp(recordedAt) ? recordedAt : null });
      } catch {
        return err('storage-failed');
      }
    },
  };
}

async function insertLapse(tx: Executor, lapse: NewLapse): Promise<LapseRecord> {
  await tx.run('INSERT INTO lapse (at, recorded_at) VALUES (?, ?)', [lapse.at, lapse.recordedAt]);
  const rows = await tx.all('SELECT last_insert_rowid() AS id');
  const id = rows[0]?.id;
  if (typeof id !== 'number') throw new Error('The new lapse has no id.');
  const details = lapse.details !== null && hasDetails(lapse.details) ? lapse.details : null;
  const planChange = await changePlan(tx, lapse.plan);
  if (details !== null || planChange !== null) {
    await tx.run(
      `INSERT INTO lapse_detail (lapse_id, place_id, context, previous_plan, new_plan)
       VALUES (?, ?, ?, ?, ?)`,
      [
        id,
        details?.place ?? null,
        JSON.stringify(details?.context ?? []),
        planChange?.previous ? JSON.stringify(planChange.previous) : null,
        planChange === null ? null : JSON.stringify(planChange.next),
      ],
    );
  }
  return { id, at: lapse.at, recordedAt: lapse.recordedAt };
}

// Read in the same transaction as the write, so the previous plan kept for an undo is the one
// that was really stored, whatever the screen managed to load.
async function changePlan(tx: Executor, next: Plan | null): Promise<PlanChange | null> {
  if (next === null) return null;
  const previous = (await readFirstPlan(tx))?.plan ?? null;
  if (previous !== null && samePlan(previous, next)) return null;
  await writeFirstPlan(tx, next);
  return { previous, next };
}

async function deleteLapse(tx: Executor, id: number): Promise<boolean> {
  const lapses = await tx.all('SELECT id FROM lapse WHERE id = ?', [id]);
  if (lapses.length === 0) return false;
  const restore = planToRestore(
    await readPlanChange(tx, id),
    (await readFirstPlan(tx))?.plan ?? null,
  );
  if (restore?.kind === 'write') await writeFirstPlan(tx, restore.plan);
  if (restore?.kind === 'remove') await deleteFirstPlan(tx);
  await tx.run('DELETE FROM lapse_detail WHERE lapse_id = ?', [id]);
  await tx.run('DELETE FROM lapse WHERE id = ?', [id]);
  return true;
}

async function readPlanChange(tx: Executor, id: number): Promise<PlanChange | null> {
  const rows = await tx.all('SELECT previous_plan, new_plan FROM lapse_detail WHERE lapse_id = ?', [
    id,
  ]);
  const row = rows[0];
  if (row === undefined) return null;
  const next = decodePlan(parseJson(row.new_plan));
  if (next === null) return null;
  if (row.previous_plan === null) return { previous: null, next };
  const previous = decodePlan(parseJson(row.previous_plan));
  return previous === null ? null : { previous, next };
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && isValidTimestamp(value);
}

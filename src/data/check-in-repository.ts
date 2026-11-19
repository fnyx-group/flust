import type { Database, Executor, Row } from '@/data/database';
import { parseJson } from '@/data/json-codec';
import { attempt, type StorageError } from '@/data/storage-error';
import { parseCheckIn, type CheckIn, type CheckInAnswers } from '@/domain/check-in';
import { ok, type Result } from '@/domain/result';
import type { Timestamp } from '@/domain/time';

export type CheckInStorageError = StorageError;

export type CheckInRepository = {
  // Stores the check-in of `day`, or updates it when that day already has one.
  save(
    day: number,
    at: Timestamp,
    answers: CheckInAnswers,
  ): Promise<Result<CheckIn, CheckInStorageError>>;
  // The check-ins from `firstDay` on, the latest day first. Rows that fail validation are left
  // out rather than shown with wrong values.
  since(firstDay: number): Promise<Result<readonly CheckIn[], CheckInStorageError>>;
};

const COLUMNS = 'local_day, recorded_at, updated_at, mood, urge_level, context, note';

export function createCheckInRepository(db: Database): CheckInRepository {
  return {
    save: (day, at, answers) =>
      attempt(async () => ok(await db.transaction((tx) => upsert(tx, day, at, answers)))),

    since: (firstDay) =>
      attempt(async () => {
        const rows = await db.all(
          `SELECT ${COLUMNS} FROM check_in WHERE local_day >= ? ORDER BY local_day DESC`,
          [firstDay],
        );
        return ok(rows.flatMap((row) => toCheckIn(row) ?? []));
      }),
  };
}

// The first save of a day sets recorded_at; later ones only move updated_at. A row that cannot be
// read back rolls the write back, so nothing is stored that the app would then ignore.
async function upsert(
  tx: Executor,
  day: number,
  at: Timestamp,
  answers: CheckInAnswers,
): Promise<CheckIn> {
  await tx.run(
    `INSERT INTO check_in (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (local_day) DO UPDATE SET
       updated_at = excluded.updated_at,
       mood = excluded.mood,
       urge_level = excluded.urge_level,
       context = excluded.context,
       note = excluded.note`,
    [day, at, at, answers.mood, answers.urge, JSON.stringify(answers.context), answers.note],
  );
  const rows = await tx.all(`SELECT ${COLUMNS} FROM check_in WHERE local_day = ?`, [day]);
  const saved = rows[0] === undefined ? null : toCheckIn(rows[0]);
  if (saved === null) throw new Error('The saved check-in cannot be read back.');
  return saved;
}

function toCheckIn(row: Row): CheckIn | null {
  const parsed = parseCheckIn({
    day: row.local_day,
    recordedAt: row.recorded_at,
    updatedAt: row.updated_at,
    mood: row.mood,
    urge: row.urge_level,
    context: parseJson(row.context),
    note: row.note,
  });
  return parsed.ok ? parsed.value : null;
}

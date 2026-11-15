import type { Database, Executor, Row } from '@/data/database';
import { decodeAction, decodeText } from '@/data/json-codec';
import type { Plan, Reason } from '@/domain/onboarding';
import { isPlanTrigger, isReasonId, isRiskMomentId, type RiskMomentId } from '@/domain/presets';
import {
  checkPlan,
  checkPlanRemoval,
  checkReason,
  type PlanEntry,
  type ReasonEntry,
  type RemovePlanError,
  type SavePlanError,
  type SaveReasonError,
} from '@/domain/profile';
import { err, ok, type Result } from '@/domain/result';

export type ProfileStorageError = 'storage-failed';
export type SaveReasonStorageError = SaveReasonError | 'not-found' | ProfileStorageError;
export type SavePlanStorageError = SavePlanError | 'not-found' | ProfileStorageError;
export type RemovePlanStorageError = RemovePlanError | ProfileStorageError;

// What the user told the onboarding about themselves, read back by the emergency and lapse
// screens.
export type Profile = {
  readonly reasons: readonly Reason[];
  readonly riskMoments: readonly RiskMomentId[];
  readonly plans: readonly Plan[];
};

// The same, with the id of each row, for the reasons and plans editor.
export type ProfileEntries = {
  readonly reasons: readonly ReasonEntry[];
  readonly riskMoments: readonly RiskMomentId[];
  readonly plans: readonly PlanEntry[];
};

// Saves take the id of the row to change, or null to add one at the end, and return the id of the
// row written. Rules are checked against the rows read in the same transaction, never against
// what the screen loaded earlier. Removing a row that is already gone counts as done.
export type ProfileRepository = {
  load(): Promise<Result<Profile, ProfileStorageError>>;
  loadEntries(): Promise<Result<ProfileEntries, ProfileStorageError>>;
  saveReason(id: number | null, reason: Reason): Promise<Result<number, SaveReasonStorageError>>;
  removeReason(id: number): Promise<Result<void, ProfileStorageError>>;
  saveRiskMoments(moments: readonly RiskMomentId[]): Promise<Result<void, ProfileStorageError>>;
  savePlan(id: number | null, plan: Plan): Promise<Result<number, SavePlanStorageError>>;
  removePlan(id: number): Promise<Result<void, RemovePlanStorageError>>;
};

// A row that cannot be read is left out rather than reported: one damaged reason must not hide
// the others, or the plan, from someone going through an urge.
export function createProfileRepository(db: Database): ProfileRepository {
  async function attempt<T, E>(
    task: (tx: Executor) => Promise<Result<T, E>>,
  ): Promise<Result<T, E | ProfileStorageError>> {
    try {
      return await db.transaction(task);
    } catch {
      return err('storage-failed');
    }
  }

  return {
    async load() {
      const entries = await attempt(async (tx) => ok(await readEntries(tx)));
      if (!entries.ok) return entries;
      const { reasons, riskMoments, plans } = entries.value;
      return ok({
        reasons: reasons.map((entry) => entry.reason),
        riskMoments,
        plans: plans.map((entry) => entry.plan),
      });
    },

    loadEntries: () => attempt(async (tx) => ok(await readEntries(tx))),

    saveReason: (id, reason) =>
      attempt(async (tx) => {
        const reasons = await readReasonEntries(tx);
        if (id !== null && !reasons.some((entry) => entry.id === id)) return err('not-found');
        const checked = checkReason(reasons, id, reason);
        if (!checked.ok) return checked;
        return ok(await writeReason(tx, id, reason));
      }),

    removeReason: (id) =>
      attempt(async (tx) => {
        await tx.run('DELETE FROM reason WHERE id = ?', [id]);
        return ok(undefined);
      }),

    saveRiskMoments: (moments) =>
      attempt(async (tx) => {
        await writeRiskMoments(tx, moments);
        return ok(undefined);
      }),

    savePlan: (id, plan) =>
      attempt(async (tx) => {
        const plans = await readPlanEntries(tx);
        if (id !== null && !plans.some((entry) => entry.id === id)) return err('not-found');
        const checked = checkPlan(plans, id, plan);
        if (!checked.ok) return checked;
        if (id !== null) {
          await updatePlan(tx, id, plan);
          return ok(id);
        }
        await tx.run(
          `INSERT INTO plan (position, trigger_id, action_preset_id, action_custom_text)
           VALUES ((SELECT coalesce(max(position), -1) + 1 FROM plan), ?, ?, ?)`,
          planColumns(plan),
        );
        return ok(await lastInsertId(tx));
      }),

    // Only readable plans count, so a damaged row never stands in for the last plan.
    removePlan: (id) =>
      attempt(async (tx) => {
        const allowed = checkPlanRemoval(await readPlanEntries(tx), id);
        if (!allowed.ok) return allowed;
        await deletePlan(tx, id);
        return ok(undefined);
      }),
  };
}

async function readEntries(tx: Executor): Promise<ProfileEntries> {
  const moments = await tx.all('SELECT preset_id FROM risk_moment ORDER BY position');
  return {
    reasons: await readReasonEntries(tx),
    riskMoments: moments.map((row) => row.preset_id).filter(isRiskMomentId),
    plans: await readPlanEntries(tx),
  };
}

async function readReasonEntries(tx: Executor): Promise<ReasonEntry[]> {
  const rows = await tx.all('SELECT id, preset_id, custom_text FROM reason ORDER BY position, id');
  return rows.flatMap((row) => {
    const reason = toReason(row);
    return reason === null || typeof row.id !== 'number' ? [] : [{ id: row.id, reason }];
  });
}

export async function readPlanEntries(tx: Executor): Promise<PlanEntry[]> {
  const rows = await tx.all(
    `SELECT id, trigger_id, action_preset_id, action_custom_text FROM plan ORDER BY position, id`,
  );
  return rows.flatMap((row) => {
    const plan = toPlan(row);
    return plan === null || typeof row.id !== 'number' ? [] : [{ id: row.id, plan }];
  });
}

// The plan the lapse screen adjusts: the first one that can be read.
export async function readFirstPlan(tx: Executor): Promise<PlanEntry | null> {
  return (await readPlanEntries(tx))[0] ?? null;
}

// Returns the id of the row written. A plan added here goes first, since it is the one the lapse
// screen showed.
export async function writeFirstPlan(tx: Executor, plan: Plan): Promise<number> {
  const current = await readFirstPlan(tx);
  if (current !== null) {
    await updatePlan(tx, current.id, plan);
    return current.id;
  }
  await tx.run(
    `INSERT INTO plan (position, trigger_id, action_preset_id, action_custom_text)
     VALUES ((SELECT coalesce(min(position), 1) - 1 FROM plan), ?, ?, ?)`,
    planColumns(plan),
  );
  return lastInsertId(tx);
}

export async function updatePlan(tx: Executor, id: number, plan: Plan): Promise<void> {
  await tx.run(
    `UPDATE plan SET trigger_id = ?, action_preset_id = ?, action_custom_text = ? WHERE id = ?`,
    [...planColumns(plan), id],
  );
}

export async function deletePlan(tx: Executor, id: number): Promise<void> {
  await tx.run('DELETE FROM plan WHERE id = ?', [id]);
}

export async function writeRiskMoments(
  tx: Executor,
  moments: readonly RiskMomentId[],
): Promise<void> {
  await tx.run('DELETE FROM risk_moment');
  for (const [position, moment] of moments.entries()) {
    await tx.run('INSERT INTO risk_moment (preset_id, position) VALUES (?, ?)', [moment, position]);
  }
}

async function writeReason(tx: Executor, id: number | null, reason: Reason): Promise<number> {
  const values = [
    reason.kind === 'preset' ? reason.id : null,
    reason.kind === 'custom' ? reason.text : null,
  ];
  if (id !== null) {
    await tx.run('UPDATE reason SET preset_id = ?, custom_text = ? WHERE id = ?', [...values, id]);
    return id;
  }
  await tx.run(
    `INSERT INTO reason (position, preset_id, custom_text)
     VALUES ((SELECT coalesce(max(position), -1) + 1 FROM reason), ?, ?)`,
    values,
  );
  return lastInsertId(tx);
}

async function lastInsertId(tx: Executor): Promise<number> {
  const rows = await tx.all('SELECT last_insert_rowid() AS id');
  const id = rows[0]?.id;
  if (typeof id !== 'number') throw new Error('The new row has no id.');
  return id;
}

function toReason(row: Row): Reason | null {
  if (isReasonId(row.preset_id)) return { kind: 'preset', id: row.preset_id };
  const text = decodeText(row.custom_text);
  return text === null ? null : { kind: 'custom', text };
}

function toPlan(row: Row): Plan | null {
  if (!isPlanTrigger(row.trigger_id)) return null;
  const action =
    row.action_preset_id === null
      ? decodeAction({ kind: 'custom', text: row.action_custom_text })
      : decodeAction({ kind: 'preset', id: row.action_preset_id });
  return action === null ? null : { trigger: row.trigger_id, action };
}

function planColumns({ trigger, action }: Plan): [string, string | null, string | null] {
  return [
    trigger,
    action.kind === 'preset' ? action.id : null,
    action.kind === 'custom' ? action.text : null,
  ];
}

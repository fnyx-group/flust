import type { Database, Executor, Row } from '@/data/database';
import { decodeAction, decodeText } from '@/data/json-codec';
import type { Plan, Reason } from '@/domain/onboarding';
import { isPlanTrigger, isReasonId, isRiskMomentId, type RiskMomentId } from '@/domain/presets';
import { err, ok, type Result } from '@/domain/result';

export type ProfileStorageError = 'storage-failed';

// What the user told the onboarding about themselves, read back by the emergency and lapse
// screens.
export type Profile = {
  readonly reasons: readonly Reason[];
  readonly riskMoments: readonly RiskMomentId[];
  readonly plans: readonly Plan[];
};

export type ProfileRepository = {
  load(): Promise<Result<Profile, ProfileStorageError>>;
};

// A row that cannot be read is left out rather than reported: one damaged reason must not hide
// the others, or the plan, from someone going through an urge.
export function createProfileRepository(db: Database): ProfileRepository {
  return {
    async load() {
      try {
        return ok(await db.transaction(readProfile));
      } catch {
        return err('storage-failed');
      }
    },
  };
}

async function readProfile(tx: Executor): Promise<Profile> {
  const reasons = await tx.all('SELECT preset_id, custom_text FROM reason ORDER BY position, id');
  const moments = await tx.all('SELECT preset_id FROM risk_moment ORDER BY position');
  return {
    reasons: reasons.flatMap(toReason),
    riskMoments: moments.map((row) => row.preset_id).filter(isRiskMomentId),
    plans: (await readPlanRows(tx)).flatMap((row) => {
      const plan = toPlan(row);
      return plan === null ? [] : [plan];
    }),
  };
}

// The plan the emergency screen shows and the lapse screen adjusts: the first one that can be
// read.
export async function readFirstPlan(tx: Executor): Promise<{ id: number; plan: Plan } | null> {
  for (const row of await readPlanRows(tx)) {
    const plan = toPlan(row);
    if (plan !== null && typeof row.id === 'number') return { id: row.id, plan };
  }
  return null;
}

export async function writeFirstPlan(tx: Executor, plan: Plan): Promise<void> {
  const current = await readFirstPlan(tx);
  const values = [plan.trigger, ...actionColumns(plan)];
  if (current === null) {
    await tx.run(
      `INSERT INTO plan (position, trigger_id, action_preset_id, action_custom_text)
       VALUES ((SELECT coalesce(min(position), 1) - 1 FROM plan), ?, ?, ?)`,
      values,
    );
    return;
  }
  await tx.run(
    `UPDATE plan SET trigger_id = ?, action_preset_id = ?, action_custom_text = ? WHERE id = ?`,
    [...values, current.id],
  );
}

export async function deleteFirstPlan(tx: Executor): Promise<void> {
  const current = await readFirstPlan(tx);
  if (current !== null) await tx.run('DELETE FROM plan WHERE id = ?', [current.id]);
}

function readPlanRows(tx: Executor): Promise<readonly Row[]> {
  return tx.all(
    `SELECT id, trigger_id, action_preset_id, action_custom_text FROM plan ORDER BY position, id`,
  );
}

function toReason(row: Row): Reason[] {
  if (isReasonId(row.preset_id)) return [{ kind: 'preset', id: row.preset_id }];
  const text = decodeText(row.custom_text);
  return text === null ? [] : [{ kind: 'custom', text }];
}

function toPlan(row: Row): Plan | null {
  if (!isPlanTrigger(row.trigger_id)) return null;
  const action =
    row.action_preset_id === null
      ? decodeAction({ kind: 'custom', text: row.action_custom_text })
      : decodeAction({ kind: 'preset', id: row.action_preset_id });
  return action === null ? null : { trigger: row.trigger_id, action };
}

function actionColumns({ action }: Plan): [string | null, string | null] {
  return action.kind === 'preset' ? [action.id, null] : [null, action.text];
}

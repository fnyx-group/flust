import type { Database, Executor } from '@/data/database';
import { insertJourney } from '@/data/journey-repository';
import { decodeDraft, encodeDraft } from '@/data/onboarding-draft-codec';
import {
  EMPTY_DRAFT,
  type OnboardingDraft,
  type OnboardingResult,
  type Plan,
  type Reason,
} from '@/domain/onboarding';
import type { RiskMomentId } from '@/domain/presets';
import { err, ok, type Result } from '@/domain/result';

export type OnboardingStorageError = 'storage-failed';

export type OnboardingRepository = {
  loadDraft(): Promise<Result<OnboardingDraft, OnboardingStorageError>>;
  saveDraft(draft: OnboardingDraft): Promise<Result<void, OnboardingStorageError>>;
  complete(result: OnboardingResult): Promise<Result<void, OnboardingStorageError>>;
};

export function createOnboardingRepository(db: Database): OnboardingRepository {
  return {
    async loadDraft() {
      try {
        const rows = await db.all('SELECT step, answers FROM onboarding_draft WHERE id = 1');
        const row = rows[0];
        return ok(row === undefined ? EMPTY_DRAFT : decodeDraft(row.step, row.answers));
      } catch {
        return err('storage-failed');
      }
    },

    // A save queued behind the end of the onboarding, such as a back press while it finishes,
    // must not bring the draft back once a journey exists: nothing would ever delete it.
    async saveDraft(draft) {
      const { step, answers } = encodeDraft(draft);
      try {
        await db.transaction((tx) =>
          tx.run(
            `INSERT INTO onboarding_draft (id, step, answers)
             SELECT 1, ?, ? WHERE NOT EXISTS (SELECT 1 FROM journey)
             ON CONFLICT (id) DO UPDATE SET step = excluded.step, answers = excluded.answers`,
            [step, answers],
          ),
        );
        return ok(undefined);
      } catch {
        return err('storage-failed');
      }
    },

    // One transaction: either the journey exists with every answer saved and the draft is gone,
    // or nothing changed and the onboarding resumes where it was. An existing journey makes it
    // fail rather than be replaced.
    async complete(result) {
      try {
        await db.transaction(async (tx) => {
          await insertJourney(tx, result.journey);
          await writeReasons(tx, result.reasons);
          await writeRiskMoments(tx, result.riskMoments);
          await writePlans(tx, result.plans);
          await tx.run('DELETE FROM onboarding_draft');
        });
        return ok(undefined);
      } catch {
        return err('storage-failed');
      }
    },
  };
}

async function writeReasons(tx: Executor, reasons: readonly Reason[]): Promise<void> {
  await tx.run('DELETE FROM reason');
  for (const [position, reason] of reasons.entries()) {
    await tx.run('INSERT INTO reason (position, preset_id, custom_text) VALUES (?, ?, ?)', [
      position,
      reason.kind === 'preset' ? reason.id : null,
      reason.kind === 'custom' ? reason.text : null,
    ]);
  }
}

async function writeRiskMoments(tx: Executor, moments: readonly RiskMomentId[]): Promise<void> {
  await tx.run('DELETE FROM risk_moment');
  for (const [position, moment] of moments.entries()) {
    await tx.run('INSERT INTO risk_moment (preset_id, position) VALUES (?, ?)', [moment, position]);
  }
}

async function writePlans(tx: Executor, plans: readonly Plan[]): Promise<void> {
  await tx.run('DELETE FROM plan');
  for (const [position, { trigger, action }] of plans.entries()) {
    await tx.run(
      `INSERT INTO plan (position, trigger_id, action_preset_id, action_custom_text)
       VALUES (?, ?, ?, ?)`,
      [
        position,
        trigger,
        action.kind === 'preset' ? action.id : null,
        action.kind === 'custom' ? action.text : null,
      ],
    );
  }
}

import type { Database, Executor } from '@/data/database';
import { insertJourney } from '@/data/journey-repository';
import { encodeLockSettings } from '@/data/lock-codec';
import { decodeDraft, encodeDraft } from '@/data/onboarding-draft-codec';
import { insertPlan, reasonColumns, writeRiskMoments } from '@/data/profile-repository';
import { encodeReminderSettings } from '@/data/reminder-settings-codec';
import { SETTING_KEYS, writeSetting } from '@/data/setting-store';
import { attempt, type StorageError } from '@/data/storage-error';
import {
  EMPTY_DRAFT,
  type OnboardingDraft,
  type OnboardingResult,
  type Plan,
  type Reason,
} from '@/domain/onboarding';
import { ok, type Result } from '@/domain/result';

export type OnboardingStorageError = StorageError;

export type OnboardingRepository = {
  loadDraft(): Promise<Result<OnboardingDraft, OnboardingStorageError>>;
  saveDraft(draft: OnboardingDraft): Promise<Result<void, OnboardingStorageError>>;
  complete(result: OnboardingResult): Promise<Result<void, OnboardingStorageError>>;
};

export function createOnboardingRepository(db: Database): OnboardingRepository {
  return {
    loadDraft: () =>
      attempt(async () => {
        const rows = await db.all('SELECT step, answers FROM onboarding_draft WHERE id = 1');
        const row = rows[0];
        return ok(row === undefined ? EMPTY_DRAFT : decodeDraft(row.step, row.answers));
      }),

    // A save queued behind the end of the onboarding, such as a back press while it finishes,
    // must not bring the draft back once a journey exists: nothing would ever delete it.
    saveDraft(draft) {
      const { step, answers } = encodeDraft(draft);
      return attempt(async () => {
        await db.transaction((tx) =>
          tx.run(
            `INSERT INTO onboarding_draft (id, step, answers)
             SELECT 1, ?, ? WHERE NOT EXISTS (SELECT 1 FROM journey)
             ON CONFLICT (id) DO UPDATE SET step = excluded.step, answers = excluded.answers`,
            [step, answers],
          ),
        );
        return ok(undefined);
      });
    },

    // One transaction: either the journey exists with every answer saved and the draft is gone,
    // or nothing changed and the onboarding resumes where it was. An existing journey makes it
    // fail rather than be replaced.
    complete: (result) =>
      attempt(async () => {
        await db.transaction(async (tx) => {
          await insertJourney(tx, result.journey);
          await writeReasons(tx, result.reasons);
          await writeRiskMoments(tx, result.riskMoments);
          await writePlans(tx, result.plans);
          await writeSetting(tx, SETTING_KEYS.lock, encodeLockSettings(result.lock));
          await writeSetting(tx, SETTING_KEYS.reminders, encodeReminderSettings(result.reminders));
          await tx.run('DELETE FROM onboarding_draft');
        });
        return ok(undefined);
      }),
  };
}

async function writeReasons(tx: Executor, reasons: readonly Reason[]): Promise<void> {
  await tx.run('DELETE FROM reason');
  for (const [position, reason] of reasons.entries()) {
    await tx.run('INSERT INTO reason (position, preset_id, custom_text) VALUES (?, ?, ?)', [
      position,
      ...reasonColumns(reason),
    ]);
  }
}

async function writePlans(tx: Executor, plans: readonly Plan[]): Promise<void> {
  await tx.run('DELETE FROM plan');
  for (const [position, plan] of plans.entries()) {
    await insertPlan(tx, position, plan);
  }
}

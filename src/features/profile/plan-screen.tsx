import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ProfileEntries } from '@/data/profile-repository';
import { DEFAULT_PLAN, samePlan } from '@/domain/onboarding';
import { planTriggerOptions, type PlanEntry } from '@/domain/profile';
import { EditorShell } from '@/features/profile/editor-shell';
import { planErrorMessage, planRemoveError, planSaveError } from '@/features/profile/editor-errors';
import { EntriesUnavailable } from '@/features/profile/entries-unavailable';
import { entryTarget } from '@/features/profile/entry-param';
import { useProfileEntries } from '@/features/profile/use-profile-entries';
import { PlanFields } from '@/features/shared/plan-fields';
import { useStorage } from '@/features/storage/storage-context';

export function PlanScreen({ idParam }: { idParam: string | string[] | undefined }) {
  const { t } = useTranslation();
  const storage = useStorage();
  const [target] = useState(() => entryTarget(idParam));
  const { state, retry } = useProfileEntries(storage.profile);
  const missing = t('profile.plan.errors.not-found');

  if (target.kind === 'invalid') return <EntriesUnavailable message={missing} />;
  if (state.status === 'loading') return <EntriesUnavailable message={null} />;
  if (state.status === 'failed') {
    return <EntriesUnavailable message={t('profile.loadFailed')} onRetry={retry} />;
  }
  const { plans } = state.entries;
  const entry =
    target.kind === 'edit' ? (plans.find((plan) => plan.id === target.id) ?? null) : null;
  if (target.kind === 'edit' && entry === null) return <EntriesUnavailable message={missing} />;
  return <PlanEditor entries={state.entries} entry={entry} />;
}

// The plan editor of the onboarding and the lapse screen. A new plan starts from the default one.
// The only plan cannot be deleted, so the emergency screen always has one to show.
function PlanEditor({ entries, entry }: { entries: ProfileEntries; entry: PlanEntry | null }) {
  const { t } = useTranslation();
  const storage = useStorage();
  const original = entry?.plan ?? DEFAULT_PLAN;
  const [plan, setPlan] = useState(original);
  const dirty = !samePlan(plan, original);
  const lastPlan = entry !== null && !entries.plans.some((other) => other.id !== entry.id);

  async function save(): Promise<string | null> {
    const saved = await storage.profile.savePlan(entry?.id ?? null, plan);
    return saved.ok ? null : planErrorMessage(t, planSaveError(saved.error));
  }

  async function remove(id: number): Promise<string | null> {
    const removed = await storage.profile.removePlan(id);
    return removed.ok ? null : planErrorMessage(t, planRemoveError(removed.error));
  }

  return (
    <EditorShell
      title={t(entry === null ? 'profile.plan.titleNew' : 'profile.plan.titleEdit')}
      dirty={dirty}
      canSave={entry === null || dirty}
      save={save}
      note={lastPlan ? t('profile.plan.lastPlan') : undefined}
      removal={
        entry === null || lastPlan
          ? undefined
          : {
              label: t('profile.plan.remove'),
              confirm: {
                title: t('profile.plan.removeConfirm.title'),
                message: t('profile.plan.removeConfirm.message'),
                cancel: t('profile.plan.removeConfirm.cancel'),
                confirm: t('profile.plan.removeConfirm.confirm'),
              },
              run: () => remove(entry.id),
            }
      }
    >
      <PlanFields
        plan={plan}
        triggers={planTriggerOptions(entries.riskMoments, original.trigger)}
        onChange={setPlan}
      />
    </EditorShell>
  );
}

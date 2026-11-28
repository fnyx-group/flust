import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { parseCustomText, CUSTOM_TEXT_MAX_LENGTH } from '@/domain/custom-text';
import type { Reason } from '@/domain/onboarding';
import type { ReasonId } from '@/domain/presets';
import { reasonPresetOptions, sameReason, type ReasonEntry } from '@/domain/profile';
import { EditorShell } from '@/features/profile/editor-shell';
import { reasonErrorMessage, reasonSaveError } from '@/features/profile/editor-errors';
import { EntriesUnavailable } from '@/features/profile/entries-unavailable';
import { entryTarget } from '@/features/profile/entry-param';
import { useProfileEntries } from '@/features/profile/use-profile-entries';
import { reasonLabel } from '@/features/shared/preset-labels';
import { useStorage } from '@/features/storage/storage-context';
import { RadioGroup } from '@/ui/radio-group';
import { TextEntryRow } from '@/ui/text-entry-row';

export function ReasonScreen({ idParam }: { idParam: string | string[] | undefined }) {
  const { t } = useTranslation();
  const storage = useStorage();
  const [target] = useState(() => entryTarget(idParam));
  const { state, retry } = useProfileEntries(storage.profile);
  const missing = t('profile.reason.errors.not-found');

  if (target.kind === 'invalid') return <EntriesUnavailable message={missing} />;
  if (state.status === 'loading') return <EntriesUnavailable message={null} />;
  if (state.status === 'failed') {
    return <EntriesUnavailable message={t('profile.loadFailed')} onRetry={retry} />;
  }
  const { reasons } = state.entries;
  const entry =
    target.kind === 'edit' ? (reasons.find((reason) => reason.id === target.id) ?? null) : null;
  if (target.kind === 'edit' && entry === null) return <EntriesUnavailable message={missing} />;
  return <ReasonEditor reasons={reasons} entry={entry} />;
}

type Choice = { kind: 'preset'; id: ReasonId } | { kind: 'custom' } | null;

// The same choices as the onboarding: a preset no other reason uses, or the user's own words.
// `entry` is null for a new reason.
function ReasonEditor({
  reasons,
  entry,
}: {
  reasons: readonly ReasonEntry[];
  entry: ReasonEntry | null;
}) {
  const { t } = useTranslation();
  const storage = useStorage();
  const original = entry?.reason ?? null;
  const [choice, setChoice] = useState<Choice>(() => choiceOf(original));
  const [text, setText] = useState(() => (original?.kind === 'custom' ? original.text : ''));
  const reason = reasonOf(choice, text);
  const changed = original === null || reason === null || !sameReason(reason, original);
  const dirty = original === null ? choice !== null || text.trim() !== '' : changed;

  function changeText(value: string) {
    setText(value);
    setChoice({ kind: 'custom' });
  }

  async function save(): Promise<string | null> {
    if (reason === null) return reasonErrorMessage(t, 'save-failed');
    const saved = await storage.profile.saveReason(entry?.id ?? null, reason);
    return saved.ok ? null : reasonErrorMessage(t, reasonSaveError(saved.error));
  }

  async function remove(id: number): Promise<string | null> {
    const removed = await storage.profile.removeReason(id);
    return removed.ok ? null : reasonErrorMessage(t, 'remove-failed');
  }

  return (
    <EditorShell
      title={t(entry === null ? 'profile.reason.titleNew' : 'profile.reason.titleEdit')}
      dirty={dirty}
      canSave={reason !== null && changed}
      save={save}
      removal={
        entry === null
          ? undefined
          : {
              label: t('profile.reason.remove'),
              confirm: {
                title: t('profile.reason.removeConfirm.title'),
                cancel: t('profile.reason.removeConfirm.cancel'),
                confirm: t('profile.reason.removeConfirm.confirm'),
              },
              run: () => remove(entry.id),
            }
      }
    >
      <RadioGroup
        accessibilityLabel={t('profile.reason.choices')}
        options={reasonPresetOptions(reasons, entry?.id ?? null).map((id) => ({
          key: id,
          label: reasonLabel(t, id),
        }))}
        selected={choice?.kind === 'preset' ? choice.id : null}
        onSelect={(id) => setChoice({ kind: 'preset', id })}
        last={
          <TextEntryRow
            embedded
            label={t('profile.reason.custom')}
            accessibilityHint={t('profile.reason.customHint')}
            value={text}
            maxLength={CUSTOM_TEXT_MAX_LENGTH}
            selected={choice?.kind === 'custom'}
            onChangeText={changeText}
            onFocus={() => setChoice({ kind: 'custom' })}
          />
        }
      />
    </EditorShell>
  );
}

function choiceOf(reason: Reason | null): Choice {
  if (reason === null) return null;
  return reason.kind === 'preset' ? { kind: 'preset', id: reason.id } : { kind: 'custom' };
}

function reasonOf(choice: Choice, text: string): Reason | null {
  if (choice === null) return null;
  if (choice.kind === 'preset') return { kind: 'preset', id: choice.id };
  const parsed = parseCustomText(text);
  return parsed.ok ? { kind: 'custom', text: parsed.value } : null;
}

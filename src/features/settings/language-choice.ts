import type { Result } from '@/domain/result';
import type { LanguagePreference } from '@/lib/i18n/language';

type LanguageChoiceDeps = {
  save: (preference: LanguagePreference) => Promise<Result<void, unknown>>;
  // Runs only once the choice is stored, and only while it is still the latest one.
  apply: (preference: LanguagePreference) => Promise<void>;
  isLatest: () => boolean;
};

export type LanguageChoiceOutcome = 'applied' | 'save-failed' | 'superseded';

// Stored first and applied once stored, so the language shown is always the one the next launch
// will use. A choice overtaken by a newer one changes nothing.
export async function chooseLanguage(
  { save, apply, isLatest }: LanguageChoiceDeps,
  preference: LanguagePreference,
): Promise<LanguageChoiceOutcome> {
  const saved = await save(preference);
  if (!isLatest()) return 'superseded';
  if (!saved.ok) return 'save-failed';
  await apply(preference);
  return 'applied';
}

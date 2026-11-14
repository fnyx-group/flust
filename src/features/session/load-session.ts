import type { LoadJourneyError } from '@/data/journey-repository';
import type { Storage } from '@/data/open-storage';
import type { Journey } from '@/domain/journey';
import type { Result } from '@/domain/result';
import { i18n } from '@/lib/i18n';

// A language that cannot be read leaves the device language in place: it never blocks startup.
// Journey errors are passed on unchanged, because a corrupted journey and a storage failure lead
// to different screens.
export async function loadSession(
  storage: Storage,
): Promise<Result<Journey | null, LoadJourneyError>> {
  const language = await storage.settings.loadLanguage();
  if (language.ok && language.value !== null) await i18n.changeLanguage(language.value);
  return storage.journey.load();
}

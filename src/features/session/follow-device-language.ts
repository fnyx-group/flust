import type { SettingsRepository } from '@/data/settings-repository';
import { languageOf, toPreference, type Language } from '@/lib/i18n/language';

type LanguageSwitch = {
  readonly language: string;
  changeLanguage: (language: Language) => Promise<unknown>;
};

// Applies the device language when it is the one chosen and it changed. A chosen language stays,
// and a setting that cannot be read changes nothing.
export async function followDeviceLanguage(
  settings: Pick<SettingsRepository, 'loadLanguage'>,
  deviceLanguage: Language,
  i18n: LanguageSwitch,
): Promise<void> {
  const stored = await settings.loadLanguage();
  if (!stored.ok) return;
  const language = languageOf(toPreference(stored.value), deviceLanguage);
  if (language !== i18n.language) await i18n.changeLanguage(language);
}

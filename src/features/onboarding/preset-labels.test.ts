import { ACTION_IDS, REASON_IDS, RISK_MOMENT_IDS, URGE_TRIGGER } from '@/domain/presets';
import {
  actionLabel,
  reasonLabel,
  riskMomentLabel,
  triggerLabel,
} from '@/features/onboarding/preset-labels';
import { createI18n } from '@/lib/i18n';
import en from '@/lib/i18n/locales/en.json';
import fr from '@/lib/i18n/locales/fr.json';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

describe.each([
  ['en', en],
  ['fr', fr],
] as const)('preset labels in %s', (language, locale) => {
  const { t } = createI18n(language);

  it('translate every stored id with its own text, never a fallback', () => {
    for (const id of REASON_IDS) expect(reasonLabel(t, id)).toBe(locale.presets.reasons[id]);
    for (const id of RISK_MOMENT_IDS) {
      expect(riskMomentLabel(t, id)).toBe(locale.presets.riskMoments[id]);
      expect(triggerLabel(t, id)).toBe(locale.presets.riskMoments[id]);
    }
    for (const id of ACTION_IDS) expect(actionLabel(t, id)).toBe(locale.presets.actions[id]);
    expect(triggerLabel(t, URGE_TRIGGER)).toBe(locale.presets.triggers.urge);
  });

  it('have no unused translations', () => {
    expect(Object.keys(locale.presets.reasons).sort()).toEqual([...REASON_IDS].sort());
    expect(Object.keys(locale.presets.riskMoments).sort()).toEqual([...RISK_MOMENT_IDS].sort());
    expect(Object.keys(locale.presets.actions).sort()).toEqual([...ACTION_IDS].sort());
  });
});

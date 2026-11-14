import { parseCustomText } from '@/domain/custom-text';
import {
  ACTION_IDS,
  PLACE_IDS,
  REASON_IDS,
  RISK_MOMENT_IDS,
  URGE_TRIGGER,
  type PlanTrigger,
} from '@/domain/presets';
import {
  actionLabel,
  placeLabel,
  planSentence,
  reasonLabel,
  riskMomentLabel,
  triggerLabel,
} from '@/features/shared/preset-labels';
import { createI18n } from '@/lib/i18n';
import { unwrap } from '@test/arbitraries';
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
    expect(Object.keys(locale.presets.places).sort()).toEqual([...PLACE_IDS].sort());
    expect(Object.keys(locale.presets.sentences.conditions).sort()).toEqual(
      [...RISK_MOMENT_IDS, URGE_TRIGGER].sort(),
    );
    expect(Object.keys(locale.presets.sentences.actions).sort()).toEqual([...ACTION_IDS].sort());
  });

  it('name every place', () => {
    for (const id of PLACE_IDS) expect(placeLabel(t, id)).toBe(locale.presets.places[id]);
  });

  it('write every plan as a sentence, with its own words for each trigger and action', () => {
    const triggers: PlanTrigger[] = [...RISK_MOMENT_IDS, URGE_TRIGGER];
    for (const trigger of triggers) {
      for (const id of ACTION_IDS) {
        const sentence = planSentence(t, { trigger, action: { kind: 'preset', id } });
        expect(sentence).toContain(locale.presets.sentences.conditions[trigger]);
        expect(sentence).toContain(locale.presets.sentences.actions[id]);
      }
    }
  });
});

describe('planSentence', () => {
  const custom = unwrap(parseCustomText('Call Sam & Alex'));

  it('reads as one sentence in French and English', () => {
    expect(
      planSentence(createI18n('fr').t, {
        trigger: 'in-bed-at-night',
        action: { kind: 'preset', id: 'phone-out-of-room' },
      }),
    ).toBe('Si je suis au lit le soir, alors je pose le téléphone hors de la chambre.');
    expect(
      planSentence(createI18n('en').t, {
        trigger: 'urge',
        action: { kind: 'preset', id: 'guided-breathing' },
      }),
    ).toBe('If an urge hits, then I start the guided breathing.');
  });

  it("keeps the user's own action exactly as written, after a colon", () => {
    expect(
      planSentence(createI18n('fr').t, {
        trigger: 'stress',
        action: { kind: 'custom', text: custom },
      }),
    ).toBe('Si le stress monte, alors\u00a0: Call Sam & Alex');
    expect(
      planSentence(createI18n('en').t, {
        trigger: 'stress',
        action: { kind: 'custom', text: custom },
      }),
    ).toBe('If stress builds up, then: Call Sam & Alex');
  });
});

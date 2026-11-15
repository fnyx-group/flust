import { parseCustomText } from '@/domain/custom-text';
import { planColumns, reasonText } from '@/features/profile/labels';
import { createI18n } from '@/lib/i18n';
import { unwrap } from '@test/arbitraries';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

const french = createI18n('fr').t;
const english = createI18n('en').t;
const mine = unwrap(parseCustomText('appeler Sam'));

describe('reasonText', () => {
  it('translates a preset and keeps the user text as written', () => {
    expect(reasonText(french, { kind: 'preset', id: 'sleep' })).toBe(
      french('presets.reasons.sleep'),
    );
    expect(reasonText(french, { kind: 'custom', text: mine })).toBe('appeler Sam');
  });
});

describe('planColumns', () => {
  it('words both columns exactly as in the plan sentence', () => {
    expect(
      planColumns(french, {
        trigger: 'in-bed-at-night',
        action: { kind: 'preset', id: 'phone-out-of-room' },
      }),
    ).toEqual({
      when: 'je suis au lit le soir',
      then: 'je pose le téléphone hors de la chambre',
    });
    expect(
      planColumns(english, { trigger: 'urge', action: { kind: 'preset', id: 'guided-breathing' } }),
    ).toEqual({ when: 'an urge hits', then: 'I start the guided breathing' });
  });

  it('keeps the user action as written', () => {
    expect(
      planColumns(french, { trigger: 'urge', action: { kind: 'custom', text: mine } }),
    ).toEqual({ when: 'une envie arrive', then: 'appeler Sam' });
  });
});

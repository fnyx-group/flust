import { parseCustomText } from '@/domain/custom-text';
import { reasonText } from '@/features/profile/labels';
import { createI18n } from '@/lib/i18n';
import { unwrap } from '@test/arbitraries';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

const french = createI18n('fr').t;
const mine = unwrap(parseCustomText('appeler Sam'));

describe('reasonText', () => {
  it('translates a preset and keeps the user text as written', () => {
    expect(reasonText(french, { kind: 'preset', id: 'sleep' })).toBe(
      french('presets.reasons.sleep'),
    );
    expect(reasonText(french, { kind: 'custom', text: mine })).toBe('appeler Sam');
  });
});

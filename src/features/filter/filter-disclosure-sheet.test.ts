import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createI18n } from '@/lib/i18n';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

// The Play Console declaration quotes the disclosure, and Google reviews the two side by side.
const declaration = readFileSync(
  join(__dirname, '../../../docs/release/google-play-vpn-declaration.md'),
  'utf8',
);

describe('the filter disclosure', () => {
  it('reads word for word as in the Google Play declaration', () => {
    expect(declaration).toContain(`French: « ${createI18n('fr').t('filter.disclosure.text')} »`);
    expect(declaration).toContain(`English: "${createI18n('en').t('filter.disclosure.text')}"`);
  });
});

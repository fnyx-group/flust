import fs from 'node:fs';
import path from 'node:path';

import appJson from '../app.json';

const root = path.join(__dirname, '..');
const locales: Record<string, string> = appJson.expo.locales;

function localeFile(file: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

// Expo copies top-level keys of a locale file to both platforms. An iOS key such as
// NSFaceIDUsageDescription then lands in Android's strings.xml without a default value, and
// lintVitalRelease fails the release build with ExtraTranslation.
describe('native strings', () => {
  it.each(Object.entries(locales))('%s keeps every string under ios or android', (_lang, file) => {
    const keys = Object.keys(localeFile(file));
    expect(keys.filter((key) => key !== 'ios' && key !== 'android')).toEqual([]);
  });

  it.each(Object.entries(locales))(
    '%s translates the Face ID prompt for iOS only',
    (_lang, file) => {
      const strings = localeFile(file);
      expect(strings.ios).toEqual({ NSFaceIDUsageDescription: expect.any(String) });
      expect(strings.android).toBeUndefined();
    },
  );

  it('covers the languages of the app', () => {
    expect(Object.keys(locales).sort()).toEqual(['en', 'fr']);
  });
});

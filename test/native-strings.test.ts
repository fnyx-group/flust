import fs from 'node:fs';
import path from 'node:path';

import { supportedLanguages } from '@/lib/i18n/language';

import appJson from '../app.json';

type PlatformStrings = Record<string, unknown>;
type LocaleFile = Record<string, unknown> & { ios?: PlatformStrings; android?: PlatformStrings };

const root = path.join(__dirname, '..');
const locales: Record<string, string> = appJson.expo.locales;

function localeFile(language: string): LocaleFile {
  const file = locales[language];
  if (file === undefined) throw new Error(`No native strings for ${language}.`);
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

function keys(strings: PlatformStrings | undefined): string[] {
  return Object.keys(strings ?? {}).sort();
}

// Expo copies top-level keys of a locale file to both platforms. An iOS key such as
// NSFaceIDUsageDescription then lands in Android's strings.xml without a default value, and
// lintVitalRelease fails the release build with ExtraTranslation.
describe('native strings', () => {
  it('exist for exactly the languages of the app', () => {
    expect(Object.keys(locales).sort()).toEqual([...supportedLanguages].sort());
  });

  it.each(supportedLanguages)('%s keeps every string under ios or android', (language) => {
    const outside = Object.keys(localeFile(language)).filter(
      (key) => key !== 'ios' && key !== 'android',
    );
    expect(outside).toEqual([]);
  });

  it.each(supportedLanguages)('%s keeps iOS Info.plist keys out of Android', (language) => {
    expect(keys(localeFile(language).android).filter((key) => key.startsWith('NS'))).toEqual([]);
  });

  it.each(supportedLanguages)('%s translates the Face ID prompt', (language) => {
    expect(localeFile(language).ios?.NSFaceIDUsageDescription).toEqual(expect.stringMatching(/\S/));
  });

  it.each(supportedLanguages)('%s translates the same strings as English', (language) => {
    const strings = localeFile(language);
    const english = localeFile('en');
    expect(keys(strings.ios)).toEqual(keys(english.ios));
    expect(keys(strings.android)).toEqual(keys(english.android));
  });
});

import { getLocales } from 'expo-localization';

// The region the person chose for the device, not the language: a French speaker in Canada gets
// the Canadian numbers, in French. It can be missing, or differ from where the person is, which
// is why the help screen lets them pick another country.
export function deviceRegion(): string | null {
  return getLocales()[0]?.regionCode ?? null;
}

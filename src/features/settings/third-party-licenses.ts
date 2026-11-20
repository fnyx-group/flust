import notices from '@/features/settings/third-party-licenses.json';

// The JavaScript packages in the bundle and the native code in the Android APK, with their
// license texts. Generated from the release build by scripts/build-licenses.ts and committed, so
// every change of a dependency shows in review (docs/decisions/0043-third-party-licenses.md).

export type ThirdPartyLibrary = {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly text: string;
};

const texts: Readonly<Record<string, string>> = notices.texts;

export const THIRD_PARTY_LIBRARIES: readonly ThirdPartyLibrary[] = notices.libraries.map(
  (library) => ({ ...library, text: texts[library.text] ?? '' }),
);

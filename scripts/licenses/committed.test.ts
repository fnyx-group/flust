import notices from '@/features/settings/third-party-licenses.json';
import { THIRD_PARTY_LIBRARIES } from '@/features/settings/third-party-licenses';

import { problemsOf } from './notices';

// The committed notices, checked on every pull request. CI regenerates them from the release
// build and fails when they differ (scripts/build-licenses.ts --check).
describe('the committed third-party licenses', () => {
  it('cover the JavaScript packages and the native code', () => {
    const names = THIRD_PARTY_LIBRARIES.map((library) => library.name);

    expect(names).toContain('react-native');
    expect(names).toContain('com.facebook.react:react-android');
    expect(names).toContain('SQLCipher');
  });

  it('give each library an allowed license and its own text', () => {
    const problems = THIRD_PARTY_LIBRARIES.flatMap((library) =>
      problemsOf({ key: library.name, ...library }),
    );

    expect(problems).toEqual([]);
  });

  it('keep no text that no library uses', () => {
    const used = new Set(notices.libraries.map((library) => library.text));

    expect(Object.keys(notices.texts).filter((id) => !used.has(id))).toEqual([]);
    expect([...used].filter((id) => !(id in notices.texts))).toEqual([]);
  });

  it('list each version of a library once', () => {
    const ids = THIRD_PARTY_LIBRARIES.map((library) => `${library.name}@${library.version}`);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

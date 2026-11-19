import { SCREEN_PRIVACY_META_DATA, setScreenPrivacy } from './with-screen-privacy';

function manifest() {
  return {
    manifest: {
      $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
      queries: [],
      application: [{ $: { 'android:name': '.MainApplication' } }],
    },
  };
}

describe('screen privacy meta-data', () => {
  it.each([true, false])('tells the native module whether to protect the screen (%s)', (on) => {
    const application = setScreenPrivacy(manifest(), on).manifest.application?.[0];

    expect(application?.['meta-data']).toEqual([
      { $: { 'android:name': SCREEN_PRIVACY_META_DATA, 'android:value': String(on) } },
    ]);
  });
});

import type { AndroidConfig } from 'expo/config-plugins';

import { removeUrlSchemes, removeUrlTypes } from './with-no-url-scheme';

const LAUNCHER = {
  action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
  category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
};

const SCHEMES = {
  action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
  category: [
    { $: { 'android:name': 'android.intent.category.DEFAULT' } },
    { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
  ],
  data: [{ $: { 'android:scheme': 'flust' } }, { $: { 'android:scheme': 'exp+flust' } }],
};

const HTTPS_QUERY = {
  intent: [
    {
      action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
      data: [{ $: { 'android:scheme': 'https' } }],
    },
  ],
};

function manifest(): AndroidConfig.Manifest.AndroidManifest {
  return {
    manifest: {
      $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
      queries: [HTTPS_QUERY],
      application: [
        {
          $: { 'android:name': '.MainApplication' },
          activity: [
            { $: { 'android:name': '.MainActivity' }, 'intent-filter': [LAUNCHER, SCHEMES] },
          ],
          'activity-alias': [
            {
              $: { 'android:name': '.Alias', 'android:targetActivity': '.MainActivity' },
              'intent-filter': [SCHEMES],
            },
          ],
        },
      ],
    },
  };
}

const PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
  <dict>
    <key>CFBundleShortVersionString</key>
    <string>0.1.0</string>
    <key>CFBundleURLTypes</key>
    <array>
      <dict>
        <key>CFBundleURLSchemes</key>
        <array>
          <string>flust</string>
          <string>org.fnyxgroup.flust</string>
        </array>
      </dict>
      <dict>
        <key>CFBundleURLSchemes</key>
        <array>
          <string>exp+flust</string>
        </array>
      </dict>
    </array>
    <key>CFBundleVersion</key>
    <string>1</string>
  </dict>
</plist>
`;

describe('no URL scheme', () => {
  it('removes the intent filters that open a URL scheme, and keeps the launcher', () => {
    const application = removeUrlSchemes(manifest()).manifest.application?.[0];

    expect(application?.activity?.[0]?.['intent-filter']).toEqual([LAUNCHER]);
    expect(application?.['activity-alias']?.[0]?.['intent-filter']).toEqual([]);
  });

  it('keeps the query that lets the app open web links in the browser', () => {
    expect(removeUrlSchemes(manifest()).manifest.queries).toEqual([HTTPS_QUERY]);
  });

  it('removes the URL types from the Info.plist and keeps the rest', () => {
    expect(removeUrlTypes(PLIST)).toBe(`<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
  <dict>
    <key>CFBundleShortVersionString</key>
    <string>0.1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
  </dict>
</plist>
`);
  });

  it('leaves an Info.plist without URL types unchanged', () => {
    const plist = removeUrlTypes(PLIST);
    expect(removeUrlTypes(plist)).toBe(plist);
  });

  it('fails on URL types it cannot cut out, rather than leaving them', () => {
    expect(() => removeUrlTypes('<key>CFBundleURLTypes</key><string>x</string>')).toThrow();
    expect(() => removeUrlTypes('<key>CFBundleURLTypes</key><array><array></array>')).toThrow();
  });
});

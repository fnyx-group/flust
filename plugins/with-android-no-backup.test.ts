import { dataExtractionRules, excludeFromBackup } from './with-android-no-backup';

const DOMAINS = [
  'root',
  'file',
  'database',
  'sharedpref',
  'external',
  'device_root',
  'device_file',
  'device_database',
  'device_sharedpref',
];

function section(xml: string, name: string): string {
  const match = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml);
  if (!match?.[1]) throw new Error(`Missing <${name}>`);
  return match[1];
}

describe('Android backup exclusion', () => {
  it.each(['cloud-backup', 'device-transfer'])('excludes every domain from %s', (name) => {
    const rules = section(dataExtractionRules(), name);
    for (const domain of DOMAINS) {
      expect(rules).toContain(`<exclude domain="${domain}" path="." />`);
    }
    expect(rules).not.toContain('<include');
  });

  it('disables backup and points the manifest to the rules', () => {
    const manifest = excludeFromBackup({
      manifest: {
        $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
        queries: [],
        application: [
          {
            $: {
              'android:name': '.MainApplication',
              'android:allowBackup': 'true',
              'android:dataExtractionRules': '@xml/secure_store_data_extraction_rules',
            },
          },
        ],
      },
    });

    expect(manifest.manifest.application?.[0]?.$).toMatchObject({
      'android:allowBackup': 'false',
      'android:fullBackupContent': 'false',
      'android:dataExtractionRules': '@xml/data_extraction_rules',
    });
  });
});

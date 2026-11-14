import fs from 'node:fs';
import path from 'node:path';

import {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  type ConfigPlugin,
} from 'expo/config-plugins';

const RULES_RESOURCE = 'data_extraction_rules';

// Every domain an app can store data in, including device-protected storage.
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

export function dataExtractionRules(): string {
  const excludes = DOMAINS.map((domain) => `    <exclude domain="${domain}" path="." />`).join(
    '\n',
  );
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<data-extraction-rules>',
    '  <cloud-backup>',
    excludes,
    '  </cloud-backup>',
    '  <device-transfer>',
    excludes,
    '  </device-transfer>',
    '</data-extraction-rules>',
    '',
  ].join('\n');
}

// allowBackup="false" stops cloud backup, but from Android 12 device-to-device transfer ignores
// it and only follows the data extraction rules. A copied database is useless without its key,
// which never leaves the keystore, so nothing is transferred at all.
export function excludeFromBackup(
  manifest: AndroidConfig.Manifest.AndroidManifest,
): AndroidConfig.Manifest.AndroidManifest {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  application.$['android:allowBackup'] = 'false';
  application.$['android:fullBackupContent'] = 'false';
  application.$['android:dataExtractionRules'] = `@xml/${RULES_RESOURCE}`;
  return manifest;
}

export const withAndroidNoBackup: ConfigPlugin = (config) => {
  const withManifest = withAndroidManifest(config, (mod) => {
    mod.modResults = excludeFromBackup(mod.modResults);
    return mod;
  });
  return withDangerousMod(withManifest, [
    'android',
    async (mod) => {
      const directory = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      await fs.promises.mkdir(directory, { recursive: true });
      await fs.promises.writeFile(
        path.join(directory, `${RULES_RESOURCE}.xml`),
        dataExtractionRules(),
      );
      return mod;
    },
  ]);
};

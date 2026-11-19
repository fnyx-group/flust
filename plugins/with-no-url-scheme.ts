import fs from 'node:fs';

import { AndroidConfig, IOSConfig, withFinalizedMod, type ConfigPlugin } from 'expo/config-plugins';

type ManifestIntentFilter = NonNullable<
  AndroidConfig.Manifest.ManifestActivity['intent-filter']
>[number];

const VIEW = 'android.intent.action.VIEW';

// A URL scheme lets any web page check that flust is installed, and open its screens. Taps on
// notifications carry their route in an intent extra and need none. See
// docs/decisions/0035-no-url-scheme-in-production.md.
function opensUrls(filter: ManifestIntentFilter): boolean {
  const views = filter.action?.some((action) => action.$['android:name'] === VIEW) ?? false;
  const schemes = filter.data?.some((data) => data.$['android:scheme'] !== undefined) ?? false;
  return views && schemes;
}

export function removeUrlSchemes(
  manifest: AndroidConfig.Manifest.AndroidManifest,
): AndroidConfig.Manifest.AndroidManifest {
  for (const application of manifest.manifest.application ?? []) {
    for (const activity of [
      ...(application.activity ?? []),
      ...(application['activity-alias'] ?? []),
    ]) {
      if (activity['intent-filter'] === undefined) continue;
      activity['intent-filter'] = activity['intent-filter'].filter((filter) => !opensUrls(filter));
    }
  }
  return manifest;
}

const URL_TYPES_KEY = '<key>CFBundleURLTypes</key>';

// The Info.plist is already written when this runs, and no plist parser is a dependency of the
// app: the key and the array that follows it are cut out of the text, nested arrays included.
export function removeUrlTypes(plist: string): string {
  const keyStart = plist.indexOf(URL_TYPES_KEY);
  if (keyStart === -1) return plist;
  const arrayStart = plist.indexOf('<array>', keyStart);
  const between = plist.slice(keyStart + URL_TYPES_KEY.length, arrayStart);
  if (arrayStart === -1 || between.trim() !== '') {
    throw new Error('CFBundleURLTypes is not followed by an array in Info.plist.');
  }
  const tags = /<array>|<\/array>/g;
  tags.lastIndex = arrayStart;
  let depth = 0;
  for (let match = tags.exec(plist); match !== null; match = tags.exec(plist)) {
    depth += match[0] === '<array>' ? 1 : -1;
    if (depth === 0) {
      const lineStart = plist.lastIndexOf('\n', keyStart) + 1;
      const end = tags.lastIndex;
      const lineEnd = plist[end] === '\n' ? end + 1 : end;
      const before = plist.slice(lineStart, keyStart);
      return plist.slice(0, before.trim() === '' ? lineStart : keyStart) + plist.slice(lineEnd);
    }
  }
  throw new Error('CFBundleURLTypes has no closing array in Info.plist.');
}

// Finalized mods run after every other mod, including Expo's own scheme plugin and the one from
// expo-dev-client, which add their schemes after the plugins of app.config.ts would have run.
export const withNoUrlScheme: ConfigPlugin = (config) => {
  const withAndroid = withFinalizedMod(config, [
    'android',
    async (mod) => {
      const path = await AndroidConfig.Paths.getAndroidManifestAsync(mod.modRequest.projectRoot);
      const manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(path);
      await AndroidConfig.Manifest.writeAndroidManifestAsync(path, removeUrlSchemes(manifest));
      return mod;
    },
  ]);
  return withFinalizedMod(withAndroid, [
    'ios',
    async (mod) => {
      const path = IOSConfig.Paths.getInfoPlistPath(mod.modRequest.projectRoot);
      const plist = await fs.promises.readFile(path, 'utf8');
      await fs.promises.writeFile(path, removeUrlTypes(plist));
      return mod;
    },
  ]);
};

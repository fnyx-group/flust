import type { ConfigContext, ExpoConfig } from 'expo/config';

import { withAndroidFilter } from './plugins/with-android-filter.ts';
import { withAndroidNoBackup } from './plugins/with-android-no-backup.ts';
import { withNoUrlScheme } from './plugins/with-no-url-scheme.ts';
import { withProductionModules } from './plugins/with-production-modules.ts';
import { withScreenPrivacy } from './plugins/with-screen-privacy.ts';

const production = { name: 'flust', identifier: 'org.fnyxgroup.flust', scheme: 'flust' };

// A distinct identifier and scheme let the development build sit next to the store app on the same phone.
const variants: Record<string, typeof production> = {
  development: { name: 'flust dev', identifier: 'org.fnyxgroup.flust.dev', scheme: 'flust-dev' },
  production,
};

// Permissions merged by the Expo template, expo-file-system and debug-only manifests, which the
// development build needs to reach Metro and the production app never uses. Blocked in production
// only. scripts/check-android-release.sh fails on a build that still has one. See
// docs/decisions/0030-production-android-permissions.md.
export const PRODUCTION_BLOCKED_PERMISSIONS = [
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.CHANGE_WIFI_MULTICAST_STATE',
  'android.permission.ACCESS_LOCAL_NETWORK',
];

// Everything a production build requests, the other half of the policy above. The config does not
// apply it: scripts/check-android-release.sh fails on any other permission, so a dependency that
// adds one is noticed before the release. The first two are the content filter's, which
// plugins/with-android-filter.ts declares (docs/decisions/0041-filter-network-permissions.md).
export const PRODUCTION_ANDROID_PERMISSIONS = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.USE_BIOMETRIC',
  'android.permission.VIBRATE',
  `${production.identifier}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`,
];

export default ({ config }: ConfigContext): ExpoConfig => {
  const name = process.env.APP_VARIANT || 'production';
  const variant = variants[name];
  if (!variant) {
    throw new Error(
      `Unknown APP_VARIANT "${name}". Use one of: ${Object.keys(variants).join(', ')}.`,
    );
  }
  const production = name === 'production';
  const screenPrivacy = name !== 'development';
  const configured = withScreenPrivacy(
    withAndroidNoBackup({
      ...config,
      name: variant.name,
      // Kept in production for expo-linking, which reads it at run time. withNoUrlScheme removes
      // its native registration (docs/decisions/0035-no-url-scheme-in-production.md).
      scheme: variant.scheme,
      slug: config.slug ?? 'flust',
      ios: { ...config.ios, bundleIdentifier: variant.identifier },
      android: {
        ...config.android,
        package: variant.identifier,
        blockedPermissions: [
          ...(config.android?.blockedPermissions ?? []),
          ...(production ? PRODUCTION_BLOCKED_PERMISSIONS : []),
        ],
      },
      // Hides the app from screenshots and the app switcher, except in the development build,
      // where screenshots are part of the work. See docs/decisions/0025-screen-privacy.md.
      // The measure of the filter's lists is a development tool.
      extra: { ...config.extra, screenPrivacy, filterMeasure: name === 'development' },
    }),
    screenPrivacy,
  );
  // The Android content filter ships in every variant (docs/decisions/0038-content-filter.md).
  // Its log of why the tunnel stopped is a development tool.
  const withFilter = withAndroidFilter(configured, { logs: name === 'development' });
  // The development build keeps flust-dev, which the dev client is opened with, and the dev client.
  return production ? withProductionModules(withNoUrlScheme(withFilter)) : withFilter;
};

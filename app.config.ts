import type { ConfigContext, ExpoConfig } from 'expo/config';

import { withAndroidNoBackup } from './plugins/with-android-no-backup.ts';

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
  'android.permission.INTERNET',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.CHANGE_WIFI_MULTICAST_STATE',
  'android.permission.ACCESS_LOCAL_NETWORK',
];

// Everything a production build requests, the other half of the policy above. The config does not
// apply it: scripts/check-android-release.sh fails on any other permission, so a dependency that
// adds one is noticed before the release.
export const PRODUCTION_ANDROID_PERMISSIONS = [
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
  return withAndroidNoBackup({
    ...config,
    name: variant.name,
    scheme: variant.scheme,
    slug: config.slug ?? 'flust',
    ios: { ...config.ios, bundleIdentifier: variant.identifier },
    android: {
      ...config.android,
      package: variant.identifier,
      blockedPermissions: [
        ...(config.android?.blockedPermissions ?? []),
        ...(name === 'production' ? PRODUCTION_BLOCKED_PERMISSIONS : []),
      ],
    },
    // Hides the app from screenshots and the app switcher, except in the development build,
    // where screenshots are part of the work. See docs/decisions/0025-screen-privacy.md.
    extra: { ...config.extra, screenPrivacy: name !== 'development' },
  });
};

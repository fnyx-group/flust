import type { ConfigContext, ExpoConfig } from 'expo/config';

import { withAndroidNoBackup } from './plugins/with-android-no-backup.ts';

const production = { name: 'flust', identifier: 'org.fnyxgroup.flust', scheme: 'flust' };

// A distinct identifier and scheme let the development build sit next to the store app on the same phone.
const variants: Record<string, typeof production> = {
  development: { name: 'flust dev', identifier: 'org.fnyxgroup.flust.dev', scheme: 'flust-dev' },
  production,
};

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
    android: { ...config.android, package: variant.identifier },
  });
};

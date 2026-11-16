import fs from 'node:fs';
import path from 'node:path';

import createConfig, { PRODUCTION_BLOCKED_PERMISSIONS } from './app.config';

const sharedBlocked = ['android.permission.USE_FINGERPRINT'];

function configFor(variant: string | undefined) {
  const previous = process.env.APP_VARIANT;
  if (variant === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = variant;
  try {
    return createConfig({
      projectRoot: __dirname,
      staticConfigPath: null,
      packageJsonPath: null,
      config: { name: 'flust', slug: 'flust', android: { blockedPermissions: sharedBlocked } },
    });
  } finally {
    if (previous === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = previous;
  }
}

function scriptBlockedPermissions(): string[] {
  const script = fs.readFileSync(path.join(__dirname, 'scripts/check-android-release.sh'), 'utf8');
  const list = /^blocked_permissions=\(\n([\s\S]*?)\n\)$/m.exec(script)?.[1] ?? '';
  return list.split('\n').map((line) => line.trim());
}

describe('app config', () => {
  it.each([['production'], [undefined]])(
    'blocks the network and storage permissions in the %s variant',
    (variant) => {
      expect(configFor(variant).android?.blockedPermissions).toEqual([
        ...sharedBlocked,
        ...PRODUCTION_BLOCKED_PERMISSIONS,
      ]);
    },
  );

  it('keeps them in the development variant, which reaches Metro over the network', () => {
    expect(configFor('development').android?.blockedPermissions).toEqual(sharedBlocked);
  });

  it('blocks INTERNET in production', () => {
    expect(PRODUCTION_BLOCKED_PERMISSIONS).toContain('android.permission.INTERNET');
  });

  it('rejects an unknown variant', () => {
    expect(() => configFor('staging')).toThrow('Unknown APP_VARIANT "staging"');
  });

  it('lists the same permissions as the release check', () => {
    expect(scriptBlockedPermissions()).toEqual(PRODUCTION_BLOCKED_PERMISSIONS);
  });
});

import fs from 'node:fs';
import path from 'node:path';

import type { ExpoConfig } from 'expo/config';
import type { ModConfig } from 'expo/config-plugins';

import createConfig, {
  PRODUCTION_ANDROID_PERMISSIONS,
  PRODUCTION_BLOCKED_PERMISSIONS,
} from './app.config';
import appJson from './app.json';

const staticConfig = appJson.expo as ExpoConfig;
const blockedInEveryVariant = staticConfig.android?.blockedPermissions ?? [];

function configFor(variant: string | undefined) {
  const previous = process.env.APP_VARIANT;
  if (variant === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = variant;
  try {
    return createConfig({
      projectRoot: __dirname,
      staticConfigPath: null,
      packageJsonPath: null,
      config: staticConfig,
    });
  } finally {
    if (previous === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = previous;
  }
}

function scriptList(name: string): string[] {
  const script = fs.readFileSync(path.join(__dirname, 'scripts/check-android-release.sh'), 'utf8');
  const list = new RegExp(`^${name}=\\(\\n([\\s\\S]*?)\\n\\)$`, 'm').exec(script)?.[1] ?? '';
  return list.split('\n').map((line) => line.trim());
}

describe('app config', () => {
  it.each([['production'], [undefined]])(
    'blocks INTERNET and the other unused permissions in the %s variant',
    (variant) => {
      const blocked = configFor(variant).android?.blockedPermissions;
      expect(blocked).toContain('android.permission.INTERNET');
      expect(blocked).toEqual([...blockedInEveryVariant, ...PRODUCTION_BLOCKED_PERMISSIONS]);
    },
  );

  it('keeps them in the development variant, which reaches Metro over the network', () => {
    const blocked = configFor('development').android?.blockedPermissions;
    expect(blocked).not.toContain('android.permission.INTERNET');
    expect(blocked).toEqual(blockedInEveryVariant);
  });

  it('rejects an unknown variant', () => {
    expect(() => configFor('staging')).toThrow('Unknown APP_VARIANT "staging"');
  });

  it('never expects a permission it blocks', () => {
    const blocked = [...blockedInEveryVariant, ...PRODUCTION_BLOCKED_PERMISSIONS];
    expect(PRODUCTION_ANDROID_PERMISSIONS.filter((p) => blocked.includes(p))).toEqual([]);
  });
});

// Plugins register their mods on the config, which the ExpoConfig type leaves out.
function modsOf(config: ExpoConfig): ModConfig | undefined {
  return (config as ExpoConfig & { mods?: ModConfig }).mods;
}

describe('URL schemes', () => {
  it.each([['production'], [undefined]])(
    'are removed from the native projects in the %s variant',
    (variant) => {
      const mods = modsOf(configFor(variant));
      expect(mods?.android?.finalized).toBeDefined();
      expect(mods?.ios?.finalized).toBeDefined();
    },
  );

  it('stay in the development variant, which the dev client opens through flust-dev', () => {
    const config = configFor('development');
    expect(config.scheme).toBe('flust-dev');
    expect(modsOf(config)?.android?.finalized).toBeUndefined();
    expect(modsOf(config)?.ios?.finalized).toBeUndefined();
  });
});

describe('the release check', () => {
  it('blocks the same permissions as the production config', () => {
    expect(scriptList('blocked_permissions')).toEqual(PRODUCTION_BLOCKED_PERMISSIONS);
  });

  it('expects the same permissions as the production config', () => {
    expect(scriptList('expected_permissions')).toEqual(PRODUCTION_ANDROID_PERMISSIONS);
  });
});

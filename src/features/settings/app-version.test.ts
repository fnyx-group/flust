import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { appVersion } from '@/features/settings/app-version';

function readRootJson(name: string) {
  return JSON.parse(readFileSync(join(__dirname, '../../..', name), 'utf8'));
}

const app = readRootJson('app.json');
const pkg = readRootJson('package.json');

const mockConstants: { expoConfig: { version?: string } | null } = { expoConfig: null };
// A getter, since the mock is set up before this file's constants exist.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return mockConstants.expoConfig;
    },
  },
}));

describe('app version', () => {
  // The stores and the screens show the app config's version; package.json must not drift.
  it('is the same in the app config and package.json', () => {
    expect(app.expo.version).toBe(pkg.version);
  });

  it('comes from the app config, and is left out when it cannot be read', () => {
    mockConstants.expoConfig = { version: app.expo.version };
    expect(appVersion()).toBe(app.expo.version);
    mockConstants.expoConfig = null;
    expect(appVersion()).toBeUndefined();
  });
});

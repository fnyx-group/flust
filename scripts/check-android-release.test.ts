import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const script = path.join(__dirname, 'check-android-release.sh');
const xmltree = path.join(__dirname, '..', 'test', 'fixtures', 'xmltree');
const internet = 'android.permission.INTERNET';
const networkState = 'android.permission.ACCESS_NETWORK_STATE';
const filterPermissions = [internet, networkState];
const filterService = 'org.fnyxgroup.flust.filter.FilterVpnService';
const missingService = "does not declare the content filter's VPN service";
const missingPermissions = 'lacks permissions the content filter needs';

// aapt2 replaced by a script that prints the permissions and the manifest tree it is given, so
// that the check runs on a small APK with no Android SDK.
const fakeAapt2 = `#!/usr/bin/env bash
case "$1 $2" in
  "dump permissions") cat "$FAKE_PERMISSIONS" ;;
  "dump xmltree") cat "$FAKE_XMLTREE" ;;
  *) exit 2 ;;
esac
`;

let folder: string;
let apk: string;
let aapt2: string;

beforeAll(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'release-check-'));
  aapt2 = path.join(folder, 'aapt2');
  fs.writeFileSync(aapt2, fakeAapt2, { mode: 0o755 });
  fs.writeFileSync(path.join(folder, 'classes.dex'), 'dex');
  fs.writeFileSync(path.join(folder, 'AndroidManifest.xml'), 'manifest');
  apk = path.join(folder, 'app.apk');
  execFileSync('zip', ['-q', apk, 'classes.dex', 'AndroidManifest.xml'], { cwd: folder });
});

afterAll(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

function check(manifest: string, permissions: readonly string[]) {
  const permissionsFile = path.join(folder, 'permissions.txt');
  fs.writeFileSync(
    permissionsFile,
    ['android.permission.POST_NOTIFICATIONS', ...permissions]
      .map((name) => `uses-permission: name='${name}'`)
      .join('\n'),
  );
  const result = spawnSync('bash', [script, apk], {
    encoding: 'utf8',
    env: {
      ...process.env,
      AAPT2: aapt2,
      FAKE_PERMISSIONS: permissionsFile,
      FAKE_XMLTREE: path.join(xmltree, `${manifest}.xmltree`),
    },
  });
  return { status: result.status, errors: result.stderr };
}

describe('the release check, for the content filter', () => {
  it('passes a build with the filter service and its two permissions', () => {
    expect(check('vpn-filter', filterPermissions)).toEqual({ status: 0, errors: '' });
  });

  it('fails on a build without the filter service', () => {
    const { status, errors } = check('vpn-none', filterPermissions);

    expect(status).toBe(1);
    expect(errors).toContain(`${missingService}:\n  ${filterService}\n`);
  });

  it.each(filterPermissions)('fails on the service without %s', (permission) => {
    const { status, errors } = check(
      'vpn-filter',
      filterPermissions.filter((other) => other !== permission),
    );

    expect(status).toBe(1);
    expect(errors).toContain(`${missingPermissions}:\n  ${permission}\n`);
  });

  it('fails on any other VPN service', () => {
    const { status, errors } = check('vpn-foreign', filterPermissions);

    expect(status).toBe(1);
    expect(errors).toContain(
      "declares VPN services other than the content filter's:\n  com.example.sdk.ProxyService\n  com.example.sdk.TunnelService\n",
    );
    expect(errors).not.toContain(missingPermissions);
  });
});

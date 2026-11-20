import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import appJson from '../app.json';

const script = path.join(__dirname, 'check-android-release.sh');
const xmltree = path.join(__dirname, '..', 'test', 'fixtures', 'xmltree');
const internet = 'android.permission.INTERNET';
const networkState = 'android.permission.ACCESS_NETWORK_STATE';
const filterPermissions = [internet, networkState];
const filterService = 'org.fnyxgroup.flust.filter.FilterVpnService';
const missingService = "does not declare the content filter's VPN service";
const missingPermissions = 'lacks permissions the content filter needs';
const notForPlay = 'is not a production build Google Play accepts:';
const versionName = appJson.expo.version;
const versionCode = String(appJson.expo.android.versionCode);
const mapping = 'BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map';
const symbols = 'BUNDLE-METADATA/com.android.tools.build.debugsymbols/arm64-v8a/libflust.so.sym';

// The Android tools replaced by scripts that print what the variables they are given hold, so that
// the check runs on small archives with no Android SDK, NDK or Java.
const fakeAapt2 = `#!/usr/bin/env bash
case "$1 $2" in
  "dump permissions") cat "$FAKE_PERMISSIONS" ;;
  "dump xmltree") cat "$FAKE_XMLTREE" ;;
  "dump badging")
    echo "package: name='$FAKE_PACKAGE' versionCode='$FAKE_VERSION_CODE' versionName='$FAKE_VERSION_NAME' platformBuildVersionName='17'"
    echo "minSdkVersion:'24'"
    echo "targetSdkVersion:'$FAKE_TARGET_SDK'"
    [[ $FAKE_DEBUGGABLE != true ]] || echo application-debuggable
    ;;
  *) exit 2 ;;
esac
`;

const fakeZipalign = `#!/usr/bin/env bash
[[ $FAKE_ZIPALIGN_BAD == '' ]] && exit 0
[[ $4 == -v ]] && printf '%s\\nVerification FAILED\\n' "$FAKE_ZIPALIGN_BAD"
exit 1
`;

const fakeReadelf = `#!/usr/bin/env bash
echo 'Program Headers:'
echo '  Type  Offset   VirtAddr           PhysAddr           FileSiz  MemSiz   Flg Align'
echo '  PHDR  0x000040 0x0000000000000040 0x0000000000000040 0x000230 0x000230 R   0x8'
echo "  LOAD  0x000000 0x0000000000000000 0x0000000000000000 0x001000 0x001000 R   0x4000"
echo "  LOAD  0x001000 0x0000000000005000 0x0000000000005000 0x002000 0x002000 R E $FAKE_LOAD_ALIGN"
`;

// bundletool, run as java -jar <jar> <command>: the bundle manifest answers the queries of the
// check, and the universal APK is the one the test gives.
const fakeJava = `#!/usr/bin/env bash
shift 2
case "$1 \${2:-}" in
  "dump manifest")
    xpath=\${4#--xpath=}
    case $xpath in
      *uses-permission*) cat "$FAKE_PERMISSION_NAMES" ;;
      *intent-filter*VIEW*) ;;
      //service*) echo ${filterService} ;;
      /manifest/@package) echo "$FAKE_PACKAGE" ;;
      /manifest/@android:versionCode) echo "$FAKE_VERSION_CODE" ;;
      /manifest/@android:versionName) echo "$FAKE_VERSION_NAME" ;;
      /manifest/uses-sdk/@android:targetSdkVersion) echo "$FAKE_TARGET_SDK" ;;
      /manifest/application/@android:debuggable) [[ $FAKE_DEBUGGABLE != true ]] || echo true ;;
      *) exit 2 ;;
    esac
    ;;
  "dump config") echo "$FAKE_BUNDLE_CONFIG" ;;
  "build-apks "*)
    for argument; do [[ $argument == --output=* ]] && output=\${argument#--output=}; done
    folder=$(mktemp -d)
    cp "$FAKE_UNIVERSAL" "$folder/universal.apk"
    (cd "$folder" && zip -q "$output" universal.apk)
    ;;
  *) exit 2 ;;
esac
`;

const fakeKeytool = `#!/usr/bin/env bash
printf '%s\\n' "$FAKE_CERTIFICATE"
`;

const fakeUpdateLicenses = `#!/usr/bin/env bash
[[ $1 == --check && $2 == --apk && -f $3 ]] || exit 2
exit "$FAKE_LICENSES_STATUS"
`;

const debugCertificate = [
  'Signer #1:',
  '',
  'Certificate #1:',
  'Owner: C=US, O=Android, CN=Android Debug',
  'Issuer: C=US, O=Android, CN=Android Debug',
  'Certificate fingerprints:',
  '\t SHA1: 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25',
  '\t SHA256: FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C',
  'Signature algorithm name: SHA256withRSA',
  'Subject Public Key Algorithm: 2048-bit RSA key',
].join('\n');

const ownCertificate = debugCertificate.replaceAll('C=US, O=Android, CN=Android Debug', 'CN=flust');

let folder: string;
let tools: string;
let apk: string;

function writeTool(name: string, content: string): string {
  const file = path.join(tools, name);
  fs.writeFileSync(file, content, { mode: 0o755 });
  return file;
}

// An archive of these files, written in a folder of its own.
function archive(name: string, files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(folder, `${name}-`));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), content);
  }
  const output = path.join(dir, name);
  execFileSync('zip', ['-q', output, ...Object.keys(files)], { cwd: dir });
  return output;
}

// An APK whose dex holds these class names, as a dex holds them: plain text between other bytes.
function apkWithClasses(name: string, classes: readonly string[]): string {
  return archive(`${name}.apk`, {
    'classes.dex': `dex\u0000${classes.join('\u0000')}\u0000`,
    'AndroidManifest.xml': 'manifest',
  });
}

function apkWithLibrary(abi = 'arm64-v8a'): string {
  return archive('library.apk', {
    'classes.dex': 'dex',
    'AndroidManifest.xml': 'manifest',
    [`lib/${abi}/libflust.so`]: 'elf',
  });
}

function bundle(metadata: readonly string[] = [mapping, symbols]): string {
  return archive('app.aab', {
    'base/dex/classes.dex': 'dex',
    'base/manifest/AndroidManifest.xml': 'manifest',
    ...Object.fromEntries(metadata.map((file) => [file, 'metadata'])),
  });
}

beforeAll(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'release-check-'));
  tools = fs.mkdtempSync(path.join(folder, 'tools-'));
  fs.mkdirSync(path.join(tools, 'bin'));
  writeTool('aapt2', fakeAapt2);
  writeTool('zipalign', fakeZipalign);
  writeTool('llvm-readelf', fakeReadelf);
  writeTool('bin/java', fakeJava);
  writeTool('bin/keytool', fakeKeytool);
  writeTool('update-licenses', fakeUpdateLicenses);
  fs.writeFileSync(path.join(tools, 'bundletool.jar'), 'jar');
  apk = apkWithClasses('app', []);
});

afterAll(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

interface Check {
  manifest?: string;
  permissions?: readonly string[];
  build?: string;
  args?: readonly string[];
  env?: Record<string, string>;
}

function check({
  manifest = 'vpn-filter',
  permissions = filterPermissions,
  build = apk,
  args = [],
  env = {},
}: Check = {}) {
  const requested = ['android.permission.POST_NOTIFICATIONS', ...permissions];
  const permissionsFile = path.join(folder, 'permissions.txt');
  fs.writeFileSync(
    permissionsFile,
    requested.map((name) => `uses-permission: name='${name}'`).join('\n'),
  );
  const namesFile = path.join(folder, 'permission-names.txt');
  fs.writeFileSync(namesFile, requested.join('\n'));
  const result = spawnSync('bash', [script, ...args, build], {
    encoding: 'utf8',
    env: {
      ...process.env,
      AAPT2: path.join(tools, 'aapt2'),
      ZIPALIGN: path.join(tools, 'zipalign'),
      LLVM_READELF: path.join(tools, 'llvm-readelf'),
      JAVA_HOME: tools,
      BUNDLETOOL: path.join(tools, 'bundletool.jar'),
      UPDATE_LICENSES: path.join(tools, 'update-licenses'),
      FAKE_PERMISSIONS: permissionsFile,
      FAKE_PERMISSION_NAMES: namesFile,
      FAKE_XMLTREE: path.join(xmltree, `${manifest}.xmltree`),
      FAKE_PACKAGE: 'org.fnyxgroup.flust',
      FAKE_VERSION_CODE: versionCode,
      FAKE_VERSION_NAME: versionName,
      FAKE_TARGET_SDK: '36',
      FAKE_DEBUGGABLE: 'false',
      FAKE_ZIPALIGN_BAD: '',
      FAKE_LOAD_ALIGN: '0x4000',
      FAKE_BUNDLE_CONFIG:
        '{"optimizations":{"uncompressNativeLibraries":{"enabled":true,"alignment":"PAGE_ALIGNMENT_16K"}}}',
      FAKE_UNIVERSAL: apk,
      FAKE_CERTIFICATE: debugCertificate,
      FAKE_LICENSES_STATUS: '0',
      ...env,
    },
  });
  return { status: result.status, output: result.stdout, errors: result.stderr };
}

function failure(options: Check = {}) {
  const { status, errors } = check(options);
  return { status, errors };
}

describe('the release check, for the content filter', () => {
  it('passes a build with the filter service and its two permissions', () => {
    expect(failure()).toEqual({ status: 0, errors: '' });
  });

  it('fails on a build without the filter service', () => {
    const { status, errors } = failure({ manifest: 'vpn-none' });

    expect(status).toBe(1);
    expect(errors).toContain(`${missingService}:\n  ${filterService}\n`);
  });

  it.each(filterPermissions)('fails on the service without %s', (permission) => {
    const { status, errors } = failure({
      permissions: filterPermissions.filter((other) => other !== permission),
    });

    expect(status).toBe(1);
    expect(errors).toContain(`${missingPermissions}:\n  ${permission}\n`);
  });

  it('fails on any other VPN service', () => {
    const { status, errors } = failure({ manifest: 'vpn-foreign' });

    expect(status).toBe(1);
    expect(errors).toContain(
      "declares VPN services other than the content filter's:\n  com.example.sdk.ProxyService\n  com.example.sdk.TunnelService\n",
    );
    expect(errors).not.toContain(missingPermissions);
  });
});

describe('the release check, for the development modules', () => {
  it.each([
    'Lexpo/modules/devclient/DevClientPackage;',
    'Lexpo/modules/devlauncher/DevLauncherController;',
    'Lexpo/modules/devmenu/DevMenuManager;',
    'Lexpo/modules/manifests/core/Manifest;',
    'Lexpo/modules/jsonutils/JSONObjectExtensionsKt;',
    'Lexpo/modules/updatesinterface/UpdatesInterface;',
    'Lexpo/modules/webview/DomWebView;',
  ])('fails on a build that holds %s', (name) => {
    const build = apkWithClasses('development', ['Lexpo/modules/kotlin/AppContext;', name]);
    const { status, errors } = failure({ build });

    expect(status).toBe(1);
    expect(errors).toContain(
      'contains classes of development modules, which production leaves out:',
    );
    expect(errors).toContain(`  class ${name.slice(0, -1)}\n`);
  });

  it('passes the modules production keeps', () => {
    const build = apkWithClasses('production', [
      'Lexpo/modules/kotlin/AppContext;',
      'Lexpo/modules/devicesettings/Settings;',
      'Lorg/fnyxgroup/flust/filter/FilterVpnService;',
    ]);

    expect(failure({ build })).toEqual({ status: 0, errors: '' });
  });
});

describe('the release check, for what Google Play accepts', () => {
  it.each([
    [
      'the development package',
      { FAKE_PACKAGE: 'org.fnyxgroup.flust.dev' },
      'package org.fnyxgroup.flust.dev, not the production org.fnyxgroup.flust',
    ],
    ['a debuggable build', { FAKE_DEBUGGABLE: 'true' }, 'debuggable'],
    [
      "a target API level below Play's",
      { FAKE_TARGET_SDK: '35' },
      'targets API level 35, below the 36 Google Play requires',
    ],
    [
      "another versionCode than app.json's",
      { FAKE_VERSION_CODE: '7' },
      `versionCode 7, not the ${versionCode} of app.json`,
    ],
    [
      "another versionName than app.json's",
      { FAKE_VERSION_NAME: '9.9.9' },
      `versionName 9.9.9, not the ${versionName} of app.json`,
    ],
  ])('fails on %s', (_name, env, problem) => {
    const { status, errors } = failure({ env });

    expect(status).toBe(1);
    expect(errors).toContain(`${notForPlay}\n  ${problem}\n`);
  });

  it('passes native libraries aligned on 16 KB', () => {
    expect(failure({ build: apkWithLibrary() })).toEqual({ status: 0, errors: '' });
  });

  it('fails on a native library with a LOAD segment aligned on 4 KB', () => {
    const { status, errors } = failure({
      build: apkWithLibrary(),
      env: { FAKE_LOAD_ALIGN: '0x1000' },
    });

    expect(status).toBe(1);
    expect(errors).toContain(
      '64-bit native libraries not aligned for 16 KB pages:\n  lib/arm64-v8a/libflust.so (LOAD aligned on 0x1000)\n',
    );
  });

  it('leaves 32-bit libraries to 4 KB pages, which 16 KB devices never load', () => {
    expect(
      failure({ build: apkWithLibrary('armeabi-v7a'), env: { FAKE_LOAD_ALIGN: '0x1000' } }),
    ).toEqual({ status: 0, errors: '' });
  });

  it.each(['arm64-v8a', 'x86_64'])('fails on a %s library aligned on 4 KB', (abi) => {
    const { status, errors } = failure({
      build: apkWithLibrary(abi),
      env: { FAKE_LOAD_ALIGN: '0x1000' },
    });

    expect(status).toBe(1);
    expect(errors).toContain(`  lib/${abi}/libflust.so (LOAD aligned on 0x1000)\n`);
  });

  it('fails on an archive that zipalign rejects, with the entries it names', () => {
    const entry = '  16384 lib/arm64-v8a/libflust.so (BAD - 4096)';
    const { status, errors } = failure({ env: { FAKE_ZIPALIGN_BAD: entry } });

    expect(status).toBe(1);
    expect(errors).toContain(`on 16 KB:\n  ${entry}\n  Verification FAILED\n`);
  });

  it('cannot check an APK for upload', () => {
    expect(failure({ args: ['--upload'] }).status).toBe(2);
  });
});

describe('the release check, for a bundle', () => {
  it('passes a debug-signed bundle, then its universal APK and its licenses', () => {
    const { status, output, errors } = check({ build: bundle() });

    expect({ status, errors }).toEqual({ status: 0, errors: '' });
    expect(output).toContain('is signed with the debug key (FA:C6:17:45');
    expect(output).toContain('Universal APK of');
    expect(output).toContain('Licenses of');
  });

  it('fails on a bundle that does not align native libraries on 16 KB', () => {
    const { status, errors } = failure({
      build: bundle(),
      env: { FAKE_BUNDLE_CONFIG: '{"optimizations":{}}' },
    });

    expect(status).toBe(1);
    expect(errors).toContain('does not align native libraries on 16 KB pages');
  });

  it.each([
    ['its R8 mapping', [symbols], 'it has no R8 mapping'],
    ['its native symbols', [mapping], 'it has no native debug symbols'],
  ])('fails on a bundle without %s', (_name, metadata, problem) => {
    const { status, errors } = failure({ build: bundle(metadata) });

    expect(status).toBe(1);
    expect(errors).toContain(problem);
  });

  it('fails on an unsigned bundle', () => {
    const { status, errors } = failure({
      build: bundle(),
      env: { FAKE_CERTIFICATE: 'Not a signed jar file' },
    });

    expect(status).toBe(1);
    expect(errors).toContain('  it is not signed\n');
  });

  it('fails for upload on a debug-signed bundle', () => {
    const { status, errors } = failure({ build: bundle(), args: ['--upload'] });

    expect(status).toBe(1);
    expect(errors).toContain('  it is signed with the debug key, not the upload key\n');
  });

  it('fails for upload while the upload certificate is a placeholder', () => {
    const { status, errors } = failure({
      build: bundle(),
      args: ['--upload'],
      env: { FAKE_CERTIFICATE: ownCertificate },
    });

    expect(status).toBe(1);
    expect(errors).toContain('the upload certificate is still a placeholder');
    expect(errors).not.toContain('debug key');
  });

  it('reports the signer of a bundle that is not for upload', () => {
    const { status, output } = check({
      build: bundle(),
      env: { FAKE_CERTIFICATE: ownCertificate },
    });

    expect(status).toBe(0);
    expect(output).toContain('is signed by CN=flust (FA:C6:17:45');
  });

  it('fails when its universal APK fails a check', () => {
    const { status, errors } = failure({
      build: bundle(),
      env: { FAKE_UNIVERSAL: apkWithLibrary(), FAKE_LOAD_ALIGN: '0x1000' },
    });

    expect(status).toBe(1);
    expect(errors).toContain('native libraries not aligned for 16 KB pages');
  });

  it('fails when the Licenses screen does not match it', () => {
    expect(failure({ build: bundle(), env: { FAKE_LICENSES_STATUS: '1' } }).status).toBe(1);
  });

  it('cannot check it when the licenses cannot be read', () => {
    expect(failure({ build: bundle(), env: { FAKE_LICENSES_STATUS: '2' } }).status).toBe(2);
  });
});

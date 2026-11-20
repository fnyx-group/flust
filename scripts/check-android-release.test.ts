import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import appJson from '../app.json';

const script = path.join(__dirname, 'check-android-release.sh');
// The files the check reads next to itself, copied with it into a repository of each test.
const scriptFiles = ['url-schemes.awk', 'vpn-services.awk', 'bundletool.sh'];
const placeholder = "upload_certificate_sha256=''";
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
const abis = ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'];
const aligned16k =
  '{"optimizations":{"uncompressNativeLibraries":{"enabled":true,"alignment":"PAGE_ALIGNMENT_16K"}}}';

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

const ownSha256 =
  '0A:1B:2C:3D:4E:5F:60:71:82:93:A4:B5:C6:D7:E8:F9:0A:1B:2C:3D:4E:5F:60:71:82:93:A4:B5:C6:D7:E8:F9';

// A certificate other than the debug key's, named as the debug key, so that only its fingerprint
// tells them apart.
function ownCertificate(bits = '4096-bit RSA key'): string {
  return debugCertificate
    .replace(/SHA256: [0-9A-F:]+/, `SHA256: ${ownSha256}`)
    .replace('2048-bit RSA key', bits);
}

let folder: string;
let tools: string;
let apk: string;
let jarSha256: string;

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

function bundle(metadata: readonly string[] = [mapping, symbols], bundleAbis = abis): string {
  return archive('app.aab', {
    'base/dex/classes.dex': 'dex',
    'base/manifest/AndroidManifest.xml': 'manifest',
    ...Object.fromEntries(bundleAbis.map((abi) => [`base/lib/${abi}/libflust.so`, 'elf'])),
    ...Object.fromEntries(metadata.map((file) => [file, 'metadata'])),
  });
}

interface Install {
  app?: unknown;
  uploadSha256?: string;
}

// A repository holding a copy of the check, its files and an app.json. The bundletool pin is that
// of the fake jar, and the upload certificate can replace the placeholder, in these copies only.
function install({ app = appJson, uploadSha256 }: Install = {}): string {
  const root = fs.mkdtempSync(path.join(folder, 'repo-'));
  const scripts = path.join(root, 'scripts');
  fs.mkdirSync(scripts);
  for (const file of scriptFiles)
    fs.copyFileSync(path.join(__dirname, file), path.join(scripts, file));
  const pin = path.join(scripts, 'bundletool.sh');
  fs.writeFileSync(
    pin,
    fs
      .readFileSync(pin, 'utf8')
      .replace(/^BUNDLETOOL_SHA256=.*$/m, `BUNDLETOOL_SHA256=${jarSha256}`),
  );
  let source = fs.readFileSync(script, 'utf8');
  expect(source).toContain(placeholder);
  if (uploadSha256 !== undefined) {
    source = source.replace(placeholder, `upload_certificate_sha256='${uploadSha256}'`);
  }
  fs.writeFileSync(path.join(scripts, 'check-android-release.sh'), source, { mode: 0o755 });
  fs.writeFileSync(path.join(root, 'app.json'), JSON.stringify(app));
  return path.join(scripts, 'check-android-release.sh');
}

// A folder of links to the commands the check and the fake tools run, all but the ones left out.
function pathWithout(...left: string[]): string {
  const bin = fs.mkdtempSync(path.join(folder, 'path-'));
  const commands = [
    'awk',
    'basename',
    'bash',
    'cat',
    'cp',
    'cut',
    'dirname',
    'grep',
    'head',
    'mkdir',
    'mktemp',
    'node',
    'rm',
    'sed',
    'sha256sum',
    'sort',
    'tail',
    'tr',
    'unzip',
    'zip',
  ];
  for (const command of commands.filter((name) => !left.includes(name))) {
    const target = execFileSync('bash', ['-c', `command -v ${command}`], {
      encoding: 'utf8',
    }).trim();
    fs.symlinkSync(target, path.join(bin, command));
  }
  return bin;
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
  jarSha256 = crypto.createHash('sha256').update('jar').digest('hex');
  apk = apkWithClasses('app', []);
  defaultScript = install();
});

let defaultScript: string;

afterAll(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

interface Check {
  manifest?: string;
  permissions?: readonly string[];
  build?: string;
  args?: readonly string[];
  env?: Record<string, string>;
  checkScript?: string;
}

function check({
  manifest = 'vpn-filter',
  permissions = filterPermissions,
  build = apk,
  args = [],
  env = {},
  checkScript = defaultScript,
}: Check = {}) {
  const requested = ['android.permission.POST_NOTIFICATIONS', ...permissions];
  const permissionsFile = path.join(folder, 'permissions.txt');
  fs.writeFileSync(
    permissionsFile,
    requested.map((name) => `uses-permission: name='${name}'`).join('\n'),
  );
  const namesFile = path.join(folder, 'permission-names.txt');
  fs.writeFileSync(namesFile, requested.join('\n'));
  const result = spawnSync('bash', [checkScript, ...args, build], {
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
      FAKE_BUNDLE_CONFIG: aligned16k,
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

  it.each(['armeabi-v7a', 'x86'])(
    'lists a %s library on 4 KB pages, which 16 KB devices never load, without failing',
    (abi) => {
      const { status, output, errors } = check({
        build: apkWithLibrary(abi),
        env: { FAKE_LOAD_ALIGN: '0x1000' },
      });

      expect({ status, errors }).toEqual({ status: 0, errors: '' });
      expect(output).toContain(
        `32-bit native libraries not aligned for 16 KB pages, which devices with 16 KB pages never load (not a failure):\n  lib/${abi}/libflust.so (LOAD aligned on 0x1000)\n`,
      );
    },
  );

  it('lists no 32-bit library when they are aligned', () => {
    expect(check({ build: apkWithLibrary('armeabi-v7a') }).output).not.toContain('32-bit');
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

  it('cannot check an archive when zipalign fails without naming an entry', () => {
    const zipalign = writeTool(
      'zipalign-old',
      '#!/usr/bin/env bash\necho "Usage: zipalign" >&2\nexit 2\n',
    );
    const { status, errors } = failure({ env: { ZIPALIGN: zipalign } });

    expect(status).toBe(2);
    expect(errors).toContain('without naming a misaligned entry');
  });
});

describe('the release check, for a bundle', () => {
  it('passes a debug-signed bundle, then its universal APK and its licenses', () => {
    const { status, output, errors } = check({ build: bundle() });

    expect({ status, errors }).toEqual({ status: 0, errors: '' });
    expect(output).toContain("is signed with the template's debug key (FA:C6:17:45");
    expect(output).toContain('Universal APK of');
    expect(output).toContain('Licenses of');
  });

  it.each([
    ['no setting', '{"optimizations":{}}', 'compressed'],
    [
      'compressed libraries, whatever the alignment',
      '{"optimizations":{"uncompressNativeLibraries":{"enabled":false,"alignment":"PAGE_ALIGNMENT_16K"}}}',
      'compressed',
    ],
    [
      'a 4 KB alignment, with the 16 KB name elsewhere',
      '{"optimizations":{"uncompressNativeLibraries":{"enabled":true,"alignment":"PAGE_ALIGNMENT_4K"}},"note":"PAGE_ALIGNMENT_16K"}',
      'PAGE_ALIGNMENT_4K',
    ],
  ])('fails on a bundle configuration with %s', (_name, config, found) => {
    const { status, errors } = failure({ build: bundle(), env: { FAKE_BUNDLE_CONFIG: config } });

    expect(status).toBe(1);
    expect(errors).toContain(`(uncompressNativeLibraries: ${found}, not PAGE_ALIGNMENT_16K)`);
  });

  it.each(abis)('fails on a bundle without %s libraries', (abi) => {
    const { status, errors } = failure({
      build: bundle(
        undefined,
        abis.filter((other) => other !== abi),
      ),
    });

    expect(status).toBe(1);
    expect(errors).toContain(`  it has no native libraries for ${abi} (base/lib/${abi}/)\n`);
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
      env: { FAKE_CERTIFICATE: ownCertificate() },
    });

    expect(status).toBe(1);
    expect(errors).toContain('the upload certificate is still a placeholder');
    expect(errors).not.toContain('debug key');
  });

  it('fails without --upload on another key than the debug key, even named as it', () => {
    const { status, output, errors } = check({
      build: bundle(),
      env: { FAKE_CERTIFICATE: ownCertificate() },
    });

    expect(status).toBe(1);
    expect(output).toContain(`is signed by C=US, O=Android, CN=Android Debug (${ownSha256})`);
    expect(errors).toContain(
      `  it is not signed with the template's debug key (FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C) but with ${ownSha256}: check an upload build with --upload\n`,
    );
  });

  it('fails on a bundle with two signers', () => {
    const { status, errors } = failure({
      build: bundle(),
      env: {
        FAKE_CERTIFICATE: `${debugCertificate}\n\n${ownCertificate().replace('Signer #1:', 'Signer #2:')}`,
      },
    });

    expect(status).toBe(1);
    expect(errors).toContain('  it has 2 signers, not one\n');
  });

  describe('for upload, once the upload certificate is set', () => {
    // In lower case without colons, as normalized() compares them.
    const uploadScript = () =>
      install({ uploadSha256: ownSha256.replaceAll(':', '').toLowerCase() });

    it('passes a bundle signed with the upload key', () => {
      const { status, errors, output } = check({
        build: bundle(),
        args: ['--upload'],
        checkScript: uploadScript(),
        env: { FAKE_CERTIFICATE: ownCertificate() },
      });

      expect({ status, errors }).toEqual({ status: 0, errors: '' });
      expect(output).toContain(`is signed by C=US, O=Android, CN=Android Debug (${ownSha256})`);
    });

    it('fails on another signer', () => {
      const other = ownCertificate().replace(ownSha256, ownSha256.replace('0A:1B', 'FF:FF'));
      const { status, errors } = failure({
        build: bundle(),
        args: ['--upload'],
        checkScript: uploadScript(),
        env: { FAKE_CERTIFICATE: other },
      });

      expect(status).toBe(1);
      expect(errors).toContain('it is not signed with the upload key: its certificate is FF:FF');
    });

    it('fails on the debug key, by its fingerprint', () => {
      const { status, errors } = failure({
        build: bundle(),
        args: ['--upload'],
        checkScript: uploadScript(),
      });

      expect(status).toBe(1);
      expect(errors).toContain('  it is signed with the debug key, not the upload key\n');
    });

    it.each([['1024-bit RSA key'], ['256-bit EC (secp256r1) key']])(
      'fails on an upload key that is a %s',
      (bits) => {
        const { status, errors } = failure({
          build: bundle(),
          args: ['--upload'],
          checkScript: uploadScript(),
          env: { FAKE_CERTIFICATE: ownCertificate(bits) },
        });

        expect(status).toBe(1);
        expect(errors).toContain('its upload key is not an RSA key of at least 2048 bits');
      },
    );
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

describe('the release check, for the version of app.json', () => {
  const withAndroid = (android: Record<string, unknown>) => ({
    expo: { ...appJson.expo, android: { ...appJson.expo.android, ...android } },
  });

  it.each([
    ['no versionCode', withAndroid({ versionCode: undefined }), 'none'],
    ['a versionCode of 0', withAndroid({ versionCode: 0 }), '0'],
    ['a fractional versionCode', withAndroid({ versionCode: 1.5 }), '1.5'],
    ['a versionCode above Play’s limit', withAndroid({ versionCode: 2100000001 }), '2100000001'],
  ])('fails with its reason on an app.json with %s', (_name, app, found) => {
    const { status, errors } = failure({ checkScript: install({ app }) });

    expect(status).toBe(1);
    expect(errors).toContain(
      `  app.json sets no valid expo.android.versionCode, a whole number from 1 to 2100000000: ${found}\n`,
    );
  });

  it('fails with its reason on an app.json with no version', () => {
    const app = { expo: { ...appJson.expo, version: undefined } };
    const { status, errors } = failure({ checkScript: install({ app }) });

    expect(status).toBe(1);
    expect(errors).toContain('  app.json sets no expo.version\n');
  });
});

describe('the release check, without its tools', () => {
  const emptySdk = () => fs.mkdtempSync(path.join(folder, 'sdk-'));

  function sdkWithBuildTools(version: string): string {
    const sdk = emptySdk();
    fs.mkdirSync(path.join(sdk, 'build-tools', version), { recursive: true });
    fs.copyFileSync(
      path.join(tools, 'zipalign'),
      path.join(sdk, 'build-tools', version, 'zipalign'),
    );
    return sdk;
  }

  it.each([
    ['no SDK', emptySdk],
    ['build-tools 34 only', () => sdkWithBuildTools('34.0.0')],
  ])('cannot check an APK without zipalign, with %s', (_name, sdk) => {
    const { status, errors } = failure({
      env: { ZIPALIGN: '', ANDROID_HOME: sdk(), PATH: pathWithout() },
    });

    expect(status).toBe(2);
    expect(errors).toContain('zipalign of build-tools 35 or later not found');
  });

  it('takes the zipalign of build-tools 35 or later from the SDK', () => {
    const sdk = sdkWithBuildTools('36.0.0');

    expect(failure({ env: { ZIPALIGN: '', ANDROID_HOME: sdk } })).toEqual({
      status: 0,
      errors: '',
    });
  });

  it('cannot check an APK without llvm-readelf', () => {
    const { status, errors } = failure({
      env: { LLVM_READELF: '', ANDROID_HOME: emptySdk(), PATH: pathWithout() },
    });

    expect(status).toBe(2);
    expect(errors).toContain('llvm-readelf not found');
  });

  it.each([
    ['an APK', () => apk],
    ['a bundle', () => bundle()],
  ])('cannot check %s without node', (_name, build) => {
    const { status, errors } = failure({ build: build(), env: { PATH: pathWithout('node') } });

    expect(status).toBe(2);
    expect(errors).toContain('node not found');
  });

  it('cannot check a bundle without keytool', () => {
    const javaHome = fs.mkdtempSync(path.join(folder, 'java-'));
    fs.mkdirSync(path.join(javaHome, 'bin'));
    fs.copyFileSync(path.join(tools, 'bin', 'java'), path.join(javaHome, 'bin', 'java'));
    fs.chmodSync(path.join(javaHome, 'bin', 'java'), 0o755);

    const { status, errors } = failure({ build: bundle(), env: { JAVA_HOME: javaHome } });

    expect(status).toBe(2);
    expect(errors).toContain('keytool not found');
  });

  it('cannot check a bundle without bundletool', () => {
    const { status, errors } = failure({ build: bundle(), env: { BUNDLETOOL: '' } });

    expect(status).toBe(2);
    expect(errors).toContain('bundletool not found');
  });

  it('cannot check a bundle with another bundletool than the pinned one', () => {
    const jar = path.join(folder, 'other.jar');
    fs.writeFileSync(jar, 'other');

    const { status, errors } = failure({ build: bundle(), env: { BUNDLETOOL: jar } });

    expect(status).toBe(2);
    expect(errors).toContain('is not bundletool 1.18.3');
  });
});

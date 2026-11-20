import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const script = path.join(__dirname, 'build-android-bundle.sh');
const bundletoolPin = path.join(__dirname, 'bundletool.sh');
const architectures = '-PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64';
const storePassword = 'store pass phrase';

// Git without the user's configuration, such as commit signing.
const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};

// pnpm logs its commands. The prebuild rewrites package.json as the real one does, and writes an
// android/ folder with a Gradle that logs how it is run and writes the build's outputs.
const fakePnpm = `#!/usr/bin/env bash
echo "$*" >> "$LOG/pnpm"
case $1 in
  install) [[ -z \${FAKE_INSTALL_CHANGE:-} ]] || echo changed > app.json ;;
  expo)
    echo '{"scripts":{"android":"expo run:android"}}' > package.json
    rm -rf android
    mkdir -p android/app
    cp "$FAKE_GRADLEW" android/gradlew
    echo key > android/app/debug.keystore
    ;;
esac
`;

const fakeGradlew = `#!/usr/bin/env bash
printf '%s\\n' "$@" > "$LOG/gradle-args"
env | grep '^ORG_GRADLE_PROJECT_' | sort > "$LOG/gradle-env" || true
[[ \${FAKE_GRADLE_STATUS:-0} -eq 0 ]] || exit "$FAKE_GRADLE_STATUS"
outputs=app/build/outputs
mkdir -p $outputs/bundle/release $outputs/mapping/release app/build/generated/sourcemaps/react/release
cp "$FAKE_AAB" $outputs/bundle/release/app-release.aab
[[ -n \${FAKE_NO_MAPPING:-} ]] || echo mapping > $outputs/mapping/release/mapping.txt
echo map > app/build/generated/sourcemaps/react/release/index.android.bundle.map
`;

const fakeCheck = `#!/usr/bin/env bash
printf '%s\\n' "$@" > "$LOG/check-args"
exit "\${FAKE_CHECK_STATUS:-0}"
`;

// bundletool, run as java -jar <jar> build-apks: an APK set holding a universal APK.
const fakeJava = `#!/usr/bin/env bash
for argument; do [[ $argument == --output=* ]] && output=\${argument#--output=}; done
folder=$(mktemp -d)
echo apk > "$folder/universal.apk"
(cd "$folder" && zip -q "$output" universal.apk)
`;

let folder: string;
let log: string;
let releases: string;

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-build-'));
  log = path.join(folder, 'log');
  releases = path.join(folder, 'releases');
  fs.mkdirSync(log);
});

afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

function writeTool(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, { mode: 0o755 });
}

// A bundle with the symbol tables of one library, as Gradle writes it.
function fakeAab(): string {
  const dir = path.join(folder, 'aab');
  const symbol = 'BUNDLE-METADATA/com.android.tools.build.debugsymbols/arm64-v8a/libflust.so.sym';
  fs.mkdirSync(path.dirname(path.join(dir, symbol)), { recursive: true });
  fs.writeFileSync(path.join(dir, symbol), 'symbols');
  execFileSync('zip', ['-q', '-r', 'app.aab', 'BUNDLE-METADATA'], { cwd: dir });
  return path.join(dir, 'app.aab');
}

// A repository with the script, a fake release check and a committed package.json and app.json,
// its scripts and android folders and .env files ignored so that the tree starts clean.
function repository(): string {
  const root = path.join(folder, 'repo');
  const scripts = path.join(root, 'scripts');
  fs.mkdirSync(scripts, { recursive: true });
  fs.copyFileSync(script, path.join(scripts, 'build-android-bundle.sh'));
  writeTool(path.join(scripts, 'check-android-release.sh'), fakeCheck);
  fs.writeFileSync(path.join(root, 'package.json'), '{}\n');
  fs.writeFileSync(
    path.join(root, 'app.json'),
    JSON.stringify({ expo: { version: '1.2.3', android: { versionCode: 7 } } }),
  );
  fs.writeFileSync(path.join(root, '.gitignore'), 'scripts/\nandroid/\n.env*\n');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, env: gitEnv });
  git('init', '-q');
  git('add', '.');
  git('commit', '-q', '-m', 'init');
  return root;
}

interface Build {
  args?: readonly string[];
  env?: Record<string, string>;
  input?: string;
}

function build(root: string, { args = [], env = {}, input = `${storePassword}\n\n` }: Build = {}) {
  const tools = path.join(folder, 'tools');
  writeTool(path.join(tools, 'bin', 'java'), fakeJava);
  writeTool(path.join(tools, 'bin', 'pnpm'), fakePnpm);
  writeTool(path.join(tools, 'gradlew'), fakeGradlew);
  const jar = path.join(tools, 'bundletool.jar');
  fs.writeFileSync(jar, 'jar');
  // The pinned hash is that of the fake jar.
  const hash = crypto.createHash('sha256').update('jar').digest('hex');
  fs.writeFileSync(
    path.join(root, 'scripts', 'bundletool.sh'),
    fs
      .readFileSync(bundletoolPin, 'utf8')
      .replace(/^BUNDLETOOL_SHA256=.*$/m, `BUNDLETOOL_SHA256=${hash}`),
  );
  const keystore = path.join(folder, 'keys', 'flust-upload.jks');
  fs.mkdirSync(path.dirname(keystore), { recursive: true });
  fs.writeFileSync(keystore, 'keystore');
  const result = spawnSync(
    'bash',
    [path.join(root, 'scripts', 'build-android-bundle.sh'), ...args],
    {
      encoding: 'utf8',
      input,
      env: {
        ...gitEnv,
        PATH: `${path.join(tools, 'bin')}:${process.env.PATH ?? ''}`,
        JAVA_HOME: tools,
        BUNDLETOOL: jar,
        FLUST_RELEASE_DIR: releases,
        FLUST_UPLOAD_KEYSTORE: keystore,
        FAKE_GRADLEW: path.join(tools, 'gradlew'),
        FAKE_AAB: fakeAab(),
        LOG: log,
        ...env,
      },
    },
  );
  return { status: result.status, output: result.stdout, errors: result.stderr };
}

function logged(name: string): string[] {
  const file = path.join(log, name);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean) : [];
}

const prebuilt = () => logged('pnpm').some((line) => line.startsWith('expo prebuild'));

function archives(): string[] {
  return fs.existsSync(releases) ? fs.readdirSync(releases) : [];
}

function gradleEnv(): Record<string, string> {
  return Object.fromEntries(
    logged('gradle-env').map((line) => {
      const [name = '', ...value] = line.split('=');
      return [name.replace('ORG_GRADLE_PROJECT_', ''), value.join('=')];
    }),
  );
}

describe('the bundle build, for upload', () => {
  it.each([
    ['a new file', (root: string) => fs.writeFileSync(path.join(root, 'new.txt'), 'new')],
    [
      'a changed file',
      (root: string) => fs.writeFileSync(path.join(root, 'package.json'), '{"changed":true}\n'),
    ],
  ])('refuses a tree with %s, before the prebuild', (_name, change) => {
    const root = repository();
    change(root);

    const { status, errors } = build(root, { args: ['--upload'] });

    expect(status).toBe(2);
    expect(errors).toContain('The working tree has changes');
    expect(prebuilt()).toBe(false);
    expect(archives()).toEqual([]);
  });

  it('refuses a .env file, which Git ignores and Expo loads', () => {
    const root = repository();
    fs.writeFileSync(path.join(root, '.env.local'), 'EXPO_PUBLIC_FLAG=1\n');

    const { status, errors } = build(root, { args: ['--upload'] });

    expect(status).toBe(2);
    expect(errors).toContain('.env.local');
    expect(prebuilt()).toBe(false);
  });

  it('refuses without FLUST_UPLOAD_KEYSTORE', () => {
    const { status, errors } = build(repository(), {
      args: ['--upload'],
      env: { FLUST_UPLOAD_KEYSTORE: '' },
    });

    expect(status).toBe(2);
    expect(errors).toContain('Set FLUST_UPLOAD_KEYSTORE');
    expect(prebuilt()).toBe(false);
  });

  it('refuses a keystore in the repository', () => {
    const root = repository();
    fs.writeFileSync(path.join(root, 'scripts', 'upload.jks'), 'keystore');

    const { status, errors } = build(root, {
      args: ['--upload'],
      env: { FLUST_UPLOAD_KEYSTORE: path.join(root, 'scripts', 'upload.jks') },
    });

    expect(status).toBe(2);
    expect(errors).toContain('The upload keystore is in the repository');
  });

  it('refuses without a password', () => {
    const { status } = build(repository(), { args: ['--upload'], input: '' });

    expect(status).toBe(2);
    expect(prebuilt()).toBe(false);
  });

  it('installs node_modules from the lockfile only, before the prebuild', () => {
    expect(build(repository(), { args: ['--upload'] }).status).toBe(0);

    expect(logged('pnpm')[0]).toBe('install --frozen-lockfile --offline');
    expect(logged('pnpm')[1]).toMatch(/^expo prebuild /);
  });

  it('refuses a tree that the install changed', () => {
    const { status, errors } = build(repository(), {
      args: ['--upload'],
      env: { FAKE_INSTALL_CHANGE: '1' },
    });

    expect(status).toBe(2);
    expect(errors).toContain('pnpm install changed the working tree');
    expect(prebuilt()).toBe(false);
  });

  it('gives the upload key to one Gradle run without a daemon, the passwords in its environment', () => {
    const { status, output } = build(repository(), { args: ['--upload'] });

    expect(status).toBe(0);
    const args = logged('gradle-args');
    expect(args).toEqual([
      '--no-daemon',
      'bundleRelease',
      architectures,
      '-PflustRequireUploadKey=true',
    ]);
    expect(gradleEnv()).toEqual({
      flustUploadKeyAlias: 'flust-upload',
      flustUploadKeyPassword: storePassword,
      flustUploadStoreFile: path.join(folder, 'keys', 'flust-upload.jks'),
      flustUploadStorePassword: storePassword,
    });
    expect(logged('check-args')[0]).toBe('--upload');
    expect(output).not.toContain(storePassword);
  });

  it('takes another key password when one is given', () => {
    build(repository(), { args: ['--upload'], input: `${storePassword}\nkey pass\n` });

    expect(gradleEnv().flustUploadKeyPassword).toBe('key pass');
  });

  it('archives the bundle as the upload build', () => {
    build(repository(), { args: ['--upload'] });

    const [archive = ''] = archives();
    expect(fs.readdirSync(path.join(releases, archive))).toContain('flust-1.2.3-7-upload.aab');
  });

  it.each([
    ['the check', { FAKE_CHECK_STATUS: '1' }],
    ['Gradle', { FAKE_GRADLE_STATUS: '1' }],
  ])('deletes the upload-signed bundle and every partial folder when %s fails', (_name, env) => {
    const root = repository();
    const leftover = path.join(releases, '1.2.3-7-old.partial');
    fs.mkdirSync(leftover, { recursive: true });

    const { status } = build(root, { args: ['--upload'], env });

    expect(status).not.toBe(0);
    expect(fs.existsSync(path.join(root, 'android', 'app', 'build', 'outputs', 'bundle'))).toBe(
      false,
    );
    expect(archives()).toEqual([]);
  });
});

describe('the bundle build, signed with the debug key', () => {
  it('builds from a tree with changes, with no upload key, no install and its own daemon', () => {
    const root = repository();
    fs.writeFileSync(path.join(root, 'new.txt'), 'new');

    expect(build(root).status).toBe(0);
    expect(logged('pnpm')).toHaveLength(1);
    expect(logged('gradle-args')).toEqual(['bundleRelease', architectures]);
    expect(logged('gradle-env')).toEqual([]);
    expect(logged('check-args')).toHaveLength(1);
    expect(logged('check-args')[0]).toMatch(/app-release\.aab$/);
    expect(archives()[0]).toMatch(/^1\.2\.3-7-[0-9a-f]{12}-dirty-\d{8}T\d{6}Z$/);
  });

  it('archives the bundle, its mapping, source map, symbols and field APK with their hashes', () => {
    const { status, output } = build(repository(), { args: ['--field-apk'] });

    expect(status).toBe(0);
    const [archive = '', ...others] = archives();
    expect(others).toEqual([]);
    expect(archive).toMatch(/^1\.2\.3-7-[0-9a-f]{12}-\d{8}T\d{6}Z$/);
    const destination = path.join(releases, archive);
    expect(fs.readdirSync(destination).sort()).toEqual([
      'SHA256SUMS',
      'flust-1.2.3-7-debug-signed.aab',
      'flust-1.2.3-7-field.apk',
      'flust-1.2.3-7-index.android.bundle.map',
      'flust-1.2.3-7-mapping.txt',
      'flust-1.2.3-7-native-debug-symbols.zip',
    ]);
    expect(fs.readFileSync(path.join(destination, 'flust-1.2.3-7-field.apk'), 'utf8')).toBe(
      'apk\n',
    );
    expect(
      execFileSync(
        'unzip',
        ['-Z1', path.join(destination, 'flust-1.2.3-7-native-debug-symbols.zip')],
        {
          encoding: 'utf8',
        },
      ),
    ).toContain('arm64-v8a/libflust.so.sym');
    const sums = fs.readFileSync(path.join(destination, 'SHA256SUMS'), 'utf8');
    const hashed = Object.fromEntries(
      sums
        .trim()
        .split('\n')
        .map((line) => {
          const [hash = '', file = ''] = line.split(/ +/);
          return [file, hash];
        }),
    );
    const sha256 = (file: string) =>
      crypto
        .createHash('sha256')
        .update(fs.readFileSync(path.join(destination, file)))
        .digest('hex');
    const archived = fs.readdirSync(destination).filter((file) => file !== 'SHA256SUMS');
    expect(Object.keys(hashed).sort()).toEqual(archived.sort());
    for (const file of archived) expect(hashed[file]).toBe(sha256(file));
    expect(output).toContain(`signed with the debug key, and its files in ${destination}:`);
  });

  it('leaves no partial folder when it fails after the archive is started', () => {
    const root = repository();
    const { status } = build(root, { env: { FAKE_NO_MAPPING: '1' } });

    expect(status).not.toBe(0);
    expect(archives()).toEqual([]);
  });

  it('puts back the package.json that the prebuild rewrites, even when the build fails', () => {
    const root = repository();

    expect(build(root, { env: { FAKE_GRADLE_STATUS: '1' } }).status).not.toBe(0);
    expect(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).toBe('{}\n');
  });

  it('refuses a bundletool jar that is not the pinned release', () => {
    const jar = path.join(folder, 'other.jar');
    fs.writeFileSync(jar, 'other');

    const { status, errors } = build(repository(), { env: { BUNDLETOOL: jar } });

    expect(status).toBe(2);
    expect(errors).toContain('is not bundletool');
    expect(prebuilt()).toBe(false);
  });
});

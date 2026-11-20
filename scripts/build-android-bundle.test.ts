import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const script = path.join(__dirname, 'build-android-bundle.sh');

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

// The prebuild is the first step after the checks: this pnpm records that it was reached, rewrites
// package.json as the prebuild does, and stops the build there.
const fakePnpm = `#!/usr/bin/env bash
touch "$PREBUILD_MARKER"
echo '{"scripts":{"android":"expo run:android"}}' > package.json
exit 3
`;

let folder: string;

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-build-'));
});

afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

// A repository with the script and a committed package.json, its scripts folder ignored so that
// the tree starts clean.
function repository(): string {
  const root = path.join(folder, 'repo');
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.copyFileSync(script, path.join(root, 'scripts', 'build-android-bundle.sh'));
  fs.writeFileSync(path.join(root, 'package.json'), '{}\n');
  fs.writeFileSync(path.join(root, '.gitignore'), 'scripts/\n');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, env: gitEnv });
  git('init', '-q');
  git('add', '.');
  git('commit', '-q', '-m', 'init');
  return root;
}

function build(root: string, args: readonly string[]) {
  const tools = path.join(folder, 'tools');
  fs.mkdirSync(path.join(tools, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(tools, 'bin', 'java'), '#!/usr/bin/env bash\n', { mode: 0o755 });
  fs.writeFileSync(path.join(tools, 'bin', 'pnpm'), fakePnpm, { mode: 0o755 });
  fs.writeFileSync(path.join(tools, 'bundletool.jar'), 'jar');
  const marker = path.join(folder, 'prebuild-reached');
  const result = spawnSync(
    'bash',
    [path.join(root, 'scripts', 'build-android-bundle.sh'), ...args],
    {
      encoding: 'utf8',
      env: {
        ...gitEnv,
        PATH: `${path.join(tools, 'bin')}:${process.env.PATH ?? ''}`,
        JAVA_HOME: tools,
        BUNDLETOOL: path.join(tools, 'bundletool.jar'),
        FLUST_RELEASE_DIR: path.join(folder, 'releases'),
        PREBUILD_MARKER: marker,
      },
    },
  );
  return { status: result.status, errors: result.stderr, prebuilt: fs.existsSync(marker) };
}

describe('the bundle build', () => {
  it.each([
    ['a new file', (root: string) => fs.writeFileSync(path.join(root, 'new.txt'), 'new')],
    [
      'a changed file',
      (root: string) => fs.writeFileSync(path.join(root, 'package.json'), '{"changed":true}\n'),
    ],
  ])('refuses an upload build from a tree with %s, before the prebuild', (_name, change) => {
    const root = repository();
    change(root);

    const { status, errors, prebuilt } = build(root, ['--upload']);

    expect(status).toBe(2);
    expect(errors).toContain('The working tree has changes');
    expect(prebuilt).toBe(false);
    expect(fs.existsSync(path.join(folder, 'releases'))).toBe(false);
  });

  it('builds for upload from a clean tree', () => {
    expect(build(repository(), ['--upload']).prebuilt).toBe(true);
  });

  it('builds a debug-signed bundle from a tree with changes', () => {
    const root = repository();
    fs.writeFileSync(path.join(root, 'new.txt'), 'new');

    expect(build(root, []).prebuilt).toBe(true);
  });

  it('puts back the package.json that the prebuild rewrites, even when the build fails', () => {
    const root = repository();

    expect(build(root, ['--upload']).status).not.toBe(0);
    expect(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).toBe('{}\n');
  });
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Collector, type AndroidReport, type NativeConfig, type PnpmLicenses } from './collect';

const MIT = 'MIT License\n\nCopyright (c) 2024 A\n';

let root: string;

function write(file: string, content: string) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), content);
}

// A package installed as pnpm does: in .pnpm, with a link at the top of node_modules.
function install(name: string, version: string, files: Record<string, string>): string {
  const dir = `node_modules/.pnpm/${name}@${version}/node_modules/${name}`;
  write(`${dir}/package.json`, JSON.stringify({ name, version }));
  for (const [file, content] of Object.entries(files)) write(`${dir}/${file}`, content);
  return path.join(root, dir);
}

function pnpm(entries: { name: string; version: string; dir: string; license: string }[]) {
  const licenses: PnpmLicenses = {};
  for (const { name, version, dir, license } of entries) {
    licenses[license] = [...(licenses[license] ?? []), { name, versions: [version], paths: [dir] }];
  }
  return licenses;
}

const NO_NATIVE: NativeConfig = { components: {}, libraries: {}, notices: {} };
const EMPTY_APK = { libraries: [], notices: [] };

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'licenses-')));
  write('licenses/texts/Apache-2.0.txt', 'Apache License\n');
  write('licenses/texts/a.txt', MIT);
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function collector(production: PnpmLicenses, overrides = {}) {
  return new Collector(root, path.join(root, 'licenses', 'texts'), overrides, production);
}

describe('the bundled packages', () => {
  it('come from the source map, with every license file of the package', () => {
    const dir = install('fonts', '1.0.0', { LICENSE: MIT, LICENSE_FONT: 'SIL OPEN FONT LICENSE' });
    const found = collector(
      pnpm([{ name: 'fonts', version: '1.0.0', dir, license: 'MIT AND OFL-1.1' }]),
    ).bundled([
      '/node_modules/.pnpm/fonts@1.0.0/node_modules/fonts/index.js',
      `${root}/node_modules/.pnpm/fonts@1.0.0/node_modules/fonts/lib/a.js`,
      '/src/app/index.tsx',
      '\u0000polyfill:external-require',
    ]);

    expect(found).toEqual([
      {
        key: 'npm:fonts',
        name: 'fonts',
        version: '1.0.0',
        license: 'MIT AND OFL-1.1',
        text: `${MIT.trim()}\n\nSIL OPEN FONT LICENSE`,
      },
    ]);
  });

  it('report a bundled package that is not a production dependency', () => {
    install('dev-only', '1.0.0', { LICENSE: MIT });
    const results = collector({});

    expect(
      results.bundled(['/node_modules/.pnpm/dev-only@1.0.0/node_modules/dev-only/a.js']),
    ).toEqual([]);
    expect(results.problems).toEqual([
      expect.stringContaining('shipped in the bundle but not a production dependency'),
    ]);
  });

  it('take the text of an override, and report the overrides nothing used', () => {
    const dir = install('bare', '2.0.0', {});
    const results = collector(pnpm([{ name: 'bare', version: '2.0.0', dir, license: 'MIT' }]), {
      'npm:bare': { text: 'a.txt' },
      'npm:gone': { text: 'a.txt' },
    });

    expect(
      results.bundled(['/node_modules/.pnpm/bare@2.0.0/node_modules/bare/a.js'])[0]?.text,
    ).toBe(MIT);
    expect(results.unusedOverrides()).toEqual(['npm:gone']);
  });
});

describe('the Android build', () => {
  const report = (overrides: Partial<AndroidReport> = {}): AndroidReport => ({
    maven: [],
    projects: [],
    ...overrides,
  });

  it('reads Maven modules, with the Apache text for Apache-2.0', () => {
    const found = collector({}).android(
      report({
        maven: [
          {
            group: 'androidx.core',
            name: 'core',
            version: '1.0.0',
            pom: '/cache/core.pom',
            licenses: [{ name: 'The Apache Software License, Version 2.0', url: '' }],
          },
        ],
      }),
      NO_NATIVE,
      EMPTY_APK,
    );

    expect(found).toEqual([
      {
        key: 'maven:androidx.core:core',
        name: 'androidx.core:core',
        version: '1.0.0',
        license: 'Apache-2.0',
        text: 'Apache License\n',
      },
    ]);
  });

  it('report a module without a readable license, and take a group override', () => {
    const results = collector({}, { 'maven:com.example': { license: 'MIT', text: 'a.txt' } });
    const maven = [
      { group: 'com.example', name: 'lib', version: '1', pom: '/c/l.pom', licenses: [] },
      { group: 'org.other', name: 'lib', version: '1', pom: '/c/o.pom', licenses: [] },
    ];
    const found = results.android(report({ maven }), NO_NATIVE, EMPTY_APK);

    expect(found[0]).toMatchObject({ license: 'MIT', text: MIT });
    expect(found[1]).toMatchObject({ license: 'UNKNOWN', text: '' });
    expect(results.problems).toEqual([
      'maven:org.other:lib: its POM declares no license we can read',
    ]);
  });

  it('read library projects and modules published inside a package from that package', () => {
    const dir = install('expo-thing', '3.0.0', { LICENSE: MIT });
    write('node_modules/.pnpm/expo-thing@3.0.0/node_modules/expo-thing/android/build.gradle', '');
    write('node_modules/.pnpm/expo-thing@3.0.0/node_modules/expo-thing/repo/thing.pom', '');
    write('modules/flust-filter/android/build.gradle', '');
    const found = collector(
      pnpm([{ name: 'expo-thing', version: '3.0.0', dir, license: 'MIT' }]),
    ).android(
      report({
        maven: [
          {
            group: 'host.exp',
            name: 'thing',
            version: '3.0.0',
            pom: path.join(dir, 'repo', 'thing.pom'),
            licenses: [{ name: 'MIT', url: '' }],
          },
        ],
        projects: [
          { path: ':expo-thing', dir: path.join(dir, 'android') },
          { path: ':flust-filter', dir: path.join(root, 'modules', 'flust-filter', 'android') },
        ],
      }),
      NO_NATIVE,
      EMPTY_APK,
    );

    expect(found.map((entry) => entry.key)).toEqual(['npm:expo-thing', 'npm:expo-thing']);
  });

  it('add the native code of the APK, with versions from a file or from what bundles it', () => {
    write('vendor/lib.h', '#define LIB_VERSION "4.2.0"\n');
    const native: NativeConfig = {
      components: {
        lib: {
          name: 'Lib',
          license: 'MIT',
          text: 'a.txt',
          version: { file: 'vendor/lib.h', pattern: 'LIB_VERSION "([0-9.]+)"' },
        },
        data: { name: 'Data', license: 'MPL-2.0', text: 'a.txt', version: { of: 'maven:g:host' } },
      },
      libraries: { 'libhost.so': ['maven:g:host', 'native:lib'] },
      notices: { 'data/NOTICE': ['native:data'] },
    };
    const host = {
      group: 'g',
      name: 'host',
      version: '7.0',
      pom: '/c/h.pom',
      licenses: [{ name: 'Apache-2.0', url: '' }],
    };
    const results = collector({});
    const found = results.android(report({ maven: [host] }), native, {
      libraries: ['libhost.so'],
      notices: ['data/NOTICE'],
    });

    expect(results.problems).toEqual([]);
    expect(found.map((entry) => [entry.name, entry.version])).toEqual([
      ['g:host', '7.0'],
      ['Data', 'g:host 7.0'],
      ['Lib', '4.2.0'],
    ]);
  });

  it('report native code the map does not cover, or covers without the APK holding it', () => {
    const native: NativeConfig = {
      components: { unused: { name: 'U', license: 'MIT', text: 'a.txt', version: { of: 'x' } } },
      libraries: { 'libgone.so': ['native:unused'], 'libheld.so': ['maven:not:shipped'] },
      notices: {},
    };
    const results = collector({});
    results.android(report(), native, {
      libraries: ['libnew.so', 'libheld.so'],
      notices: ['x/NOTICE'],
    });

    expect(results.problems).toEqual([
      'libnew.so: native library missing from licenses/native.json',
      'libheld.so: holds maven:not:shipped, which the APK does not ship',
      'libgone.so: native library listed but not in the APK',
      'x/NOTICE: notice missing from licenses/native.json',
      'native:unused: nothing in the APK holds it',
    ]);
  });
});

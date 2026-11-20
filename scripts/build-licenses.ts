// Writes the third-party notices the Licenses screen shows, from what the release build really
// ships: the packages in the JavaScript bundle's source map, the Gradle release runtime classpath
// and the native libraries of the APK (docs/decisions/0043-third-party-licenses.md). Fails, and
// lists why, on a dependency without a license text or under a license not allowed. With
// --check, fails when the committed file differs instead of writing it.
//
//   node scripts/build-licenses.ts --sourcemap <map> --android-report <json> --apk <apk> [--check]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  Collector,
  type AndroidReport,
  type ApkContents,
  type NativeConfig,
  type Overrides,
  type PnpmLicenses,
} from './licenses/collect.ts';
import { assemble } from './licenses/notices.ts';

const root = path.join(import.meta.dirname, '..');
const licenses = path.join(root, 'licenses');
const output = path.join(root, 'src', 'features', 'settings', 'third-party-licenses.json');

const { values } = parseArgs({
  options: {
    sourcemap: { type: 'string' },
    'android-report': { type: 'string' },
    apk: { type: 'string' },
    check: { type: 'boolean', default: false },
  },
});

const { sourcemap, apk } = values;
const androidReport = values['android-report'];
if (sourcemap === undefined || androidReport === undefined || apk === undefined) {
  console.error(
    'Usage: node scripts/build-licenses.ts --sourcemap <map> --android-report <json> --apk <apk> [--check]',
  );
  process.exit(2);
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

// The native libraries of the APK, without the ABI since every ABI ships the same ones, and its
// notice files, which Apache-2.0 asks to keep with the work.
function apkContents(file: string): ApkContents {
  const entries = execFileSync('unzip', ['-Z1', file], { encoding: 'utf8' }).split('\n');
  const libraries = entries.filter((entry) => /^lib\/[^/]+\/[^/]+\.so$/.test(entry));
  return {
    libraries: [...new Set(libraries.map((entry) => path.basename(entry)))].sort(),
    notices: entries.filter((entry) => /(^|\/)NOTICE(\.[a-z]+)?$/i.test(entry)).sort(),
  };
}

function pnpmLicenses(): PnpmLicenses {
  const json = execFileSync('pnpm', ['licenses', 'list', '--prod', '--json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(json) as PnpmLicenses;
}

const collector = new Collector(
  root,
  path.join(licenses, 'texts'),
  readJson<Overrides>(path.join(licenses, 'overrides.json')),
  pnpmLicenses(),
);
const sources = readJson<{ sources: string[] }>(sourcemap).sources;
const shipped = [
  ...collector.bundled(sources),
  ...collector.android(
    readJson<AndroidReport>(androidReport),
    readJson<NativeConfig>(path.join(licenses, 'native.json')),
    apkContents(apk),
  ),
];
const { notices, problems } = assemble(shipped);
problems.push(
  ...collector.problems,
  ...collector.unusedOverrides().map((key) => `${key}: override matches no shipped dependency`),
);

if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const json = `${JSON.stringify(notices, null, 2)}\n`;
if (values.check) {
  const committed = fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : '';
  if (committed !== json) {
    console.error(
      `${path.relative(root, output)} is out of date: run scripts/update-licenses.sh and commit it.`,
    );
    process.exit(1);
  }
  console.log(`${notices.libraries.length} libraries, up to date.`);
} else {
  fs.writeFileSync(output, json);
  console.log(`${notices.libraries.length} libraries written to ${path.relative(root, output)}.`);
}

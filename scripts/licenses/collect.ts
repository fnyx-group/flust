import fs from 'node:fs';
import path from 'node:path';

import type { Shipped } from './notices.ts';
import { spdxOfPom, type PomLicense } from './spdx.ts';

// What `pnpm licenses list --prod --json` prints: packages grouped by license, each with the
// folders it is installed in.
export type PnpmLicenses = Record<
  string,
  readonly { name: string; versions: readonly string[]; paths: readonly string[] }[]
>;

// What scripts/licenses/report.gradle writes.
export type AndroidReport = {
  maven: readonly {
    group: string;
    name: string;
    version: string;
    pom: string;
    licenses: readonly PomLicense[];
  }[];
  projects: readonly { path: string; dir: string }[];
};

// licenses/overrides.json: the license or the text of a dependency that does not ship them in a
// form the build can read. Keys are `npm:<name>` or `maven:<group>:<name>`, one dependency each:
// a key for a whole Maven group would give its text to any new module of the group, whatever
// that module's own license.
export type Overrides = Record<string, { license?: string; text: string }>;

// licenses/native.json: code compiled or copied into the APK without a Gradle module of its
// own, which dependencies each native library holds, and which ones each notice file of the APK
// belongs to. A component's version is read from a file of the repository, or is the version of
// the dependency that bundles it.
export type NativeConfig = {
  components: Record<
    string,
    {
      name: string;
      license: string;
      text: string;
      version: { file: string; pattern: string } | { of: string };
    }
  >;
  libraries: Record<string, readonly string[]>;
  notices: Record<string, readonly string[]>;
};

// What the APK holds that the Gradle report cannot show: native libraries by file name, and
// notice files by path.
export type ApkContents = { libraries: readonly string[]; notices: readonly string[] };

type Package = { name: string; version: string; license: string; dir: string };

// LICENSE, LICENSE.md, LICENSE_FONT, LICENSE-MIT, COPYING, NOTICE and the like: a package can
// ship several, such as the fonts with the OFL apart from the code's license.
const LICENSE_FILE = /^(licen[cs]e|copying|notice)([._-][a-z0-9]+)?(\.(md|txt|markdown))?$/i;

const OVERRIDE_KEY = /^(npm:[^:]+|maven:[^:]+:[^:]+)$/;

// A module of a package: the folder after the last node_modules of its path.
const PACKAGE_SOURCE = /^((?:.*\/)?node_modules\/(?:@[^/]+\/)?[^/@][^/]*)\//;

export class Collector {
  readonly problems: string[] = [];
  private readonly usedOverrides = new Set<string>();
  private readonly production = new Map<string, Package>();

  private readonly root: string;
  private readonly texts: string;
  private readonly overrides: Overrides;

  constructor(root: string, texts: string, overrides: Overrides, pnpm: PnpmLicenses) {
    this.root = root;
    this.texts = texts;
    this.overrides = overrides;
    for (const key of Object.keys(overrides)) {
      if (!OVERRIDE_KEY.test(key)) {
        this.problems.push(`${key}: an override names one npm package or one Maven module`);
      }
    }
    for (const [license, packages] of Object.entries(pnpm)) {
      for (const entry of packages) {
        entry.paths.forEach((dir, index) => {
          const version = entry.versions[index] ?? entry.versions[0] ?? '';
          this.production.set(fs.realpathSync(dir), { name: entry.name, version, license, dir });
        });
      }
    }
  }

  // The packages whose code is in the JavaScript bundle, from its source map. Each module sits
  // under the last node_modules of its path; the app's own files sit under none. An entry that is
  // neither fails the run rather than leave a package out of the notices.
  bundled(sources: readonly string[]): Shipped[] {
    const dirs = new Set<string>();
    for (const source of sources) {
      // Metro's virtual modules, such as its polyfills, have no file.
      if (source.startsWith('\u0000')) continue;
      const match = PACKAGE_SOURCE.exec(source);
      if (match === null) {
        if (!this.ownFile(source)) {
          this.problems.push(
            `${source}: in the source map, but neither in a package nor in the app`,
          );
        }
        continue;
      }
      dirs.add(fs.realpathSync(this.inRoot(match[1] ?? '')));
    }
    return [...dirs].flatMap((dir) => this.npm(dir, 'bundle'));
  }

  // The native code of the APK: Maven modules, library projects and what the native libraries
  // hold besides.
  android(report: AndroidReport, native: NativeConfig, apk: ApkContents): Shipped[] {
    const maven = report.maven.flatMap((module) =>
      this.inNodeModules(module.pom) ? this.packageAround(module.pom) : [this.maven(module)],
    );
    const projects = report.projects.flatMap((project) =>
      this.ownModule(project.dir) ? [] : this.packageAround(project.dir),
    );
    const known = new Map([...maven, ...projects].map((entry) => [entry.key, entry]));
    return [...maven, ...projects, ...this.native(native, apk, known)];
  }

  unusedOverrides(): string[] {
    return Object.keys(this.overrides).filter((key) => !this.usedOverrides.has(key));
  }

  private override(key: string) {
    const found = this.overrides[key];
    if (found !== undefined) this.usedOverrides.add(key);
    return found;
  }

  private readText(file: string): string {
    return fs.readFileSync(path.join(this.texts, file), 'utf8');
  }

  private npm(dir: string, origin: string): Shipped[] {
    const found = this.production.get(dir);
    if (found === undefined) {
      this.problems.push(`${dir}: shipped in the ${origin} but not a production dependency`);
      return [];
    }
    const key = `npm:${found.name}`;
    const override = this.override(key);
    const files = fs
      .readdirSync(dir)
      .filter((name) => LICENSE_FILE.test(name))
      .sort();
    const text =
      override !== undefined
        ? this.readText(override.text)
        : files.map((name) => fs.readFileSync(path.join(dir, name), 'utf8').trim()).join('\n\n');
    return [
      {
        key,
        name: found.name,
        version: found.version,
        license: override?.license ?? found.license,
        text,
      },
    ];
  }

  private maven(module: AndroidReport['maven'][number]): Shipped {
    const key = `maven:${module.group}:${module.name}`;
    const override = this.override(key);
    const license = override?.license ?? spdxOfPom(module.licenses);
    if (license === null) this.problems.push(`${key}: its POM declares no license we can read`);
    const text =
      override !== undefined
        ? this.readText(override.text)
        : license === 'Apache-2.0'
          ? this.readText('Apache-2.0.txt')
          : '';
    return {
      key,
      name: `${module.group}:${module.name}`,
      version: module.version,
      license: license ?? 'UNKNOWN',
      text,
    };
  }

  // Source map paths are absolute, or relative to the project with or without a leading slash.
  private inRoot(source: string): string {
    return source.startsWith(this.root) ? source : path.join(this.root, source);
  }

  // A file of the app, or a folder of it that a require.context module stands for, such as Expo
  // Router's `/src/app?ctx=<hash>`.
  private ownFile(source: string): boolean {
    if (/(^|\/)node_modules\//.test(source)) return false;
    const absolute = this.inRoot(source.replace(/\?ctx=[0-9a-f]+$/, ''));
    return !path.relative(this.root, absolute).startsWith('..') && fs.existsSync(absolute);
  }

  // flust's own native modules are not third-party code.
  private ownModule(dir: string): boolean {
    return !path.relative(path.join(this.root, 'modules'), dir).startsWith('..');
  }

  private inNodeModules(file: string): boolean {
    return file.split(path.sep).includes('node_modules');
  }

  // Library projects, and the Maven modules Expo publishes inside its packages, come from the
  // npm package around them.
  private packageAround(start: string): Shipped[] {
    let current = fs.realpathSync(start);
    while (!fs.existsSync(path.join(current, 'package.json'))) {
      const parent = path.dirname(current);
      if (parent === current) {
        this.problems.push(`${start}: native code outside any npm package`);
        return [];
      }
      current = parent;
    }
    return this.npm(current, 'APK');
  }

  private native(native: NativeConfig, apk: ApkContents, known: Map<string, Shipped>): Shipped[] {
    const used = new Set<string>();
    const holdings = [
      { kind: 'native library', found: apk.libraries, listed: native.libraries },
      { kind: 'notice', found: apk.notices, listed: native.notices },
    ];
    for (const { kind, found, listed } of holdings) {
      for (const file of found) {
        const holds = listed[file];
        if (holds === undefined) {
          this.problems.push(`${file}: ${kind} missing from licenses/native.json`);
          continue;
        }
        for (const key of holds) {
          if (key.startsWith('native:')) used.add(key.slice('native:'.length));
          else if (!known.has(key))
            this.problems.push(`${file}: holds ${key}, which the APK does not ship`);
        }
      }
      for (const file of Object.keys(listed)) {
        if (!found.includes(file)) this.problems.push(`${file}: ${kind} listed but not in the APK`);
      }
    }
    for (const name of Object.keys(native.components)) {
      if (!used.has(name)) this.problems.push(`native:${name}: nothing in the APK holds it`);
    }
    return [...used].sort().flatMap((name) => {
      const component = native.components[name];
      if (component === undefined) {
        this.problems.push(`native:${name}: missing from the components of licenses/native.json`);
        return [];
      }
      return [
        {
          key: `native:${name}`,
          name: component.name,
          version: this.componentVersion(name, component.version, known),
          license: component.license,
          text: this.readText(component.text),
        },
      ];
    });
  }

  private componentVersion(
    name: string,
    version: NativeConfig['components'][string]['version'],
    known: Map<string, Shipped>,
  ): string {
    if ('of' in version) {
      const host = known.get(version.of);
      if (host === undefined) this.problems.push(`native:${name}: ${version.of} is not shipped`);
      return host === undefined ? '' : `${host.name} ${host.version}`;
    }
    const source = fs.readFileSync(path.join(this.root, version.file), 'utf8');
    const found = new RegExp(version.pattern, 'm').exec(source)?.[1];
    if (found === undefined) this.problems.push(`native:${name}: no version in ${version.file}`);
    return found ?? '';
  }
}

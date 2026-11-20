import { createHash } from 'node:crypto';

import { licenseAllowed } from './allowed.ts';

// One dependency the app ships, with the text of its license.
export type Shipped = {
  readonly key: string;
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly text: string;
};

export type Library = {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly text: string;
};

// The file the Licenses screen reads: each text once, the libraries pointing to it by id, since
// most of them share the Apache or MIT text.
export type Notices = {
  readonly libraries: readonly Library[];
  readonly texts: Readonly<Record<string, string>>;
};

// A notice license asks for its copyright line to ship: a text without one is a template, not
// the dependency's own notice.
const NOTICE_LICENSES = /\b(MIT|ISC|BSD-[23]-Clause|0BSD|Zlib|BSL-1\.0)\b/;
const COPYRIGHT = /copyright|\(c\)|©/i;

function textId(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

export function problemsOf(entry: Shipped): string[] {
  const problems: string[] = [];
  let allowed = false;
  try {
    allowed = licenseAllowed(entry.license, entry.name);
  } catch (error) {
    problems.push(`${entry.key}: ${(error as Error).message}`);
  }
  if (!allowed && problems.length === 0) {
    problems.push(`${entry.key}: license ${entry.license} is not allowed`);
  }
  if (entry.text.trim() === '') problems.push(`${entry.key}: no license text`);
  else if (NOTICE_LICENSES.test(entry.license) && !COPYRIGHT.test(entry.text)) {
    problems.push(`${entry.key}: the ${entry.license} text has no copyright line`);
  }
  if (entry.version.trim() === '') problems.push(`${entry.key}: no version`);
  return problems;
}

// Sorted by name then version, so the file only changes when a dependency does. The same
// package reached twice, as JavaScript in the bundle and as native code in the APK, is listed once.
export function assemble(shipped: readonly Shipped[]): { notices: Notices; problems: string[] } {
  const problems: string[] = [];
  const byKey = new Map<string, Shipped>();
  for (const entry of shipped) {
    const id = `${entry.name}@${entry.version}`;
    const known = byKey.get(id);
    if (known !== undefined) {
      if (known.license !== entry.license || known.text !== entry.text) {
        problems.push(`${entry.key}: differs from ${known.key} for the same version`);
      }
      continue;
    }
    byKey.set(id, entry);
    problems.push(...problemsOf(entry));
  }
  const entries = [...byKey.values()].sort(
    (a, b) => a.name.localeCompare(b.name, 'en') || a.version.localeCompare(b.version, 'en'),
  );
  const texts: Record<string, string> = {};
  const libraries = entries.map((entry) => {
    const id = textId(entry.text);
    texts[id] = entry.text;
    return { name: entry.name, version: entry.version, license: entry.license, text: id };
  });
  const sortedTexts = Object.fromEntries(
    Object.entries(texts).sort(([a], [b]) => (a < b ? -1 : 1)),
  );
  return { notices: { libraries, texts: sortedTexts }, problems };
}

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { commentsOf, normalizeDomain, ownLine } from './domains.ts';
import {
  COPYLEFT_LICENSE,
  EXCLUDED_SOURCES,
  OWN_LISTS,
  PERMISSIVE_LICENSES,
  ROOT_ENTRIES,
  SOURCE_METADATA,
  SOURCES,
  type Source,
} from './layout.ts';

type Provenance = {
  fields: Map<string, string>;
  files: { upstream: string; name: string; sha256: string }[];
  malformed: string[];
};

function readProvenance(text: string): Provenance {
  const fields = new Map<string, string>();
  const files: Provenance['files'] = [];
  const malformed: string[] = [];
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const match = /^([a-z]+):\s*(.*)$/.exec(line);
    const [, key = '', value = ''] = match ?? [];
    if (key === 'file') {
      const file = /^(\S+)\s+(\S+)\s+sha256:([0-9a-f]{64})$/.exec(value);
      if (file === null) malformed.push(line);
      else files.push({ upstream: file[1] ?? '', name: file[2] ?? '', sha256: file[3] ?? '' });
    } else if (key !== '') {
      fields.set(key, value.trim());
    } else {
      malformed.push(line);
    }
  }
  return { fields, files, malformed };
}

function entriesOf(folder: string): string[] {
  return fs.existsSync(folder) ? fs.readdirSync(folder).sort() : [];
}

function unexpected(folder: string, allowed: readonly string[], label: string): string[] {
  return entriesOf(folder)
    .filter((entry) => !allowed.includes(entry))
    .map((entry) => `${label}/${entry}: not part of the lists layout`);
}

function checkLicense(folder: string, label: string, declared: string | undefined): string[] {
  const file = path.join(folder, 'LICENSE');
  if (!fs.existsSync(file)) return [`${label}: no LICENSE file`];
  const text = fs.readFileSync(file, 'utf8');
  const problems: string[] = [];
  if (COPYLEFT_LICENSE.test(text)) problems.push(`${label}/LICENSE: copyleft or share-alike terms`);
  const signature = declared === undefined ? undefined : PERMISSIVE_LICENSES[declared];
  if (signature === undefined) {
    problems.push(
      `${label}: license ${declared ?? '(none)'} is not one of MIT, Unlicense, CC0-1.0`,
    );
  } else if (!signature.test(text)) {
    problems.push(`${label}/LICENSE: does not read as ${declared}`);
  }
  return problems;
}

function checkSource(root: string, source: Source): string[] {
  const folder = path.join(root, 'sources', source.name);
  const label = `sources/${source.name}`;
  if (!fs.existsSync(folder)) return [`${label}: missing`];
  const listNames = source.files.map((file) => file.name);
  const problems = unexpected(folder, [...SOURCE_METADATA, ...listNames], label);

  const provenanceFile = path.join(folder, 'PROVENANCE');
  const provenance = fs.existsSync(provenanceFile)
    ? readProvenance(fs.readFileSync(provenanceFile, 'utf8'))
    : null;
  problems.push(...checkLicense(folder, label, provenance?.fields.get('license')));
  if (provenance === null) return [...problems, `${label}: no PROVENANCE file`];

  problems.push(
    ...provenance.malformed.map((line) => `${label}/PROVENANCE: cannot read "${line}"`),
  );
  const url = provenance.fields.get('url') ?? '';
  if (!/^https:\/\/\S+$/.test(url)) problems.push(`${label}/PROVENANCE: no source URL`);
  if (EXCLUDED_SOURCES.test(url)) problems.push(`${label}/PROVENANCE: excluded source ${url}`);
  if (!/^[0-9a-f]{40}$/.test(provenance.fields.get('commit') ?? '')) {
    problems.push(`${label}/PROVENANCE: no commit`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(provenance.fields.get('date') ?? '')) {
    problems.push(`${label}/PROVENANCE: no date`);
  }

  for (const name of listNames) {
    const recorded = provenance.files.find((file) => file.name === name);
    const listFile = path.join(folder, name);
    if (recorded === undefined) {
      problems.push(`${label}/PROVENANCE: no file line for ${name}`);
    } else if (!fs.existsSync(listFile)) {
      problems.push(`${label}/${name}: missing`);
    } else {
      const content = fs.readFileSync(listFile);
      const sha256 = createHash('sha256').update(content).digest('hex');
      if (sha256 !== recorded.sha256) problems.push(`${label}/${name}: checksum does not match`);
      if (commentsOf(content.toString('utf8')).some((comment) => EXCLUDED_SOURCES.test(comment))) {
        problems.push(`${label}/${name}: names an excluded list`);
      }
    }
  }
  return problems;
}

function checkOwnList(root: string, file: string): string[] {
  const label = `flust/${file}`;
  const full = path.join(root, 'flust', file);
  if (!fs.existsSync(full)) return [`${label}: missing`];
  const text = fs.readFileSync(full, 'utf8');
  const problems: string[] = [];
  if (commentsOf(text).some((comment) => EXCLUDED_SOURCES.test(comment))) {
    problems.push(`${label}: names an excluded list`);
  }
  text.split('\n').forEach((line, index) => {
    const entry = ownLine(line);
    if (entry === 'invalid') {
      problems.push(`${label}:${index + 1}: expected "domain  # source, checked YYYY-MM-DD"`);
    } else if (entry !== null && normalizeDomain(entry.name) !== entry.name) {
      problems.push(`${label}:${index + 1}: ${entry.name} is not a lowercase ASCII domain`);
    }
  });
  return problems;
}

// Every problem that must stop the build: a file outside the layout, a source without a
// permissive license or a matching provenance, an excluded list named anywhere, or an entry of
// flust's own lists without its source and date. A domain copied by hand from an excluded list
// without naming it cannot be told apart: that rests on review.
export function checkLists(root: string): string[] {
  const knownSources = SOURCES.map((source) => source.name);
  return [
    ...unexpected(root, ROOT_ENTRIES, 'lists'),
    ...unexpected(path.join(root, 'sources'), knownSources, 'lists/sources'),
    ...unexpected(path.join(root, 'flust'), Object.values(OWN_LISTS), 'lists/flust'),
    ...SOURCES.flatMap((source) => checkSource(root, source)),
    ...Object.values(OWN_LISTS).flatMap((file) => checkOwnList(root, file)),
  ];
}

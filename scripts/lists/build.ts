import fs from 'node:fs';
import path from 'node:path';

import { checkLists } from './check.ts';
import { normalizeDomain, ownLine, sourceLineName, withParents } from './domains.ts';
import { Category, OWN_LISTS, SOURCES, type CategoryName } from './layout.ts';

const BLOCKING = Category.adult | Category.aiNudify | Category.aiCompanions | Category.bypass;

export type SourceStats = {
  file: string;
  category: CategoryName;
  entries: number;
  invalid: number;
};

export type ListStats = {
  sources: SourceStats[];
  // Adult domains that only this source lists, before exceptions.
  onlyIn: Record<string, number>;
  categories: Record<CategoryName, number>;
  removedByExceptions: number;
  total: number;
};

export type BuiltLists = { entries: Map<string, number>; stats: ListStats };

function readNames(file: string, nameOf: (line: string) => string | null) {
  const names = new Set<string>();
  let invalid = 0;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const raw = nameOf(line);
    if (raw === null) continue;
    const name = normalizeDomain(raw);
    if (name === null) invalid += 1;
    else names.add(name);
  }
  return { names, invalid };
}

function ownNames(root: string, file: string): Set<string> {
  return readNames(path.join(root, 'flust', file), (line) => {
    const entry = ownLine(line);
    return entry === null || entry === 'invalid' ? null : entry.name;
  }).names;
}

function add(entries: Map<string, number>, names: Iterable<string>, bits: number) {
  for (const name of names) entries.set(name, (entries.get(name) ?? 0) | bits);
}

function countOnlyIn(adultSources: Map<string, Set<string>>): Record<string, number> {
  const seen = new Map<string, number>();
  for (const names of adultSources.values()) {
    for (const name of names) seen.set(name, (seen.get(name) ?? 0) + 1);
  }
  return Object.fromEntries(
    [...adultSources].map(([source, names]) => [
      source,
      [...names].filter((name) => seen.get(name) === 1).length,
    ]),
  );
}

// Reads, normalizes and merges every list, after checking the layout and the licenses. AI
// companions leave the AI nudify category, and an exception removes a domain and every name under
// it from the blocking categories.
export function buildLists(root: string): BuiltLists {
  const problems = checkLists(root);
  if (problems.length > 0) throw new Error(`The lists cannot be built:\n${problems.join('\n')}`);

  const entries = new Map<string, number>();
  const sources: SourceStats[] = [];
  const adultSources = new Map<string, Set<string>>();
  for (const source of SOURCES) {
    for (const file of source.files) {
      const { names, invalid } = readNames(
        path.join(root, 'sources', source.name, file.name),
        sourceLineName,
      );
      add(entries, names, Category[file.category]);
      sources.push({
        file: `${source.name}/${file.name}`,
        category: file.category,
        entries: names.size,
        invalid,
      });
      if (file.category === 'adult') adultSources.set(source.name, names);
    }
  }

  const nudify = ownNames(root, OWN_LISTS.aiNudify);
  const companions = ownNames(root, OWN_LISTS.aiCompanions);
  const both = [...companions].filter((name) => nudify.has(name));
  if (both.length > 0) throw new Error(`Both AI nudify and AI companions: ${both.join(', ')}`);
  add(entries, nudify, Category.aiNudify);
  for (const name of companions) entries.set(name, (entries.get(name) ?? 0) & ~Category.aiNudify);
  add(entries, companions, Category.aiCompanions);
  add(entries, ownNames(root, OWN_LISTS.bypass), Category.bypass);
  add(entries, ownNames(root, OWN_LISTS.google), Category.google);

  const exceptions = ownNames(root, OWN_LISTS.exceptions);
  let removedByExceptions = 0;
  for (const [name, bits] of entries) {
    if (!withParents(name).some((parent) => exceptions.has(parent))) continue;
    const kept = bits & ~BLOCKING;
    if ((bits & BLOCKING) !== 0) removedByExceptions += 1;
    if (kept === 0) entries.delete(name);
    else entries.set(name, kept);
  }

  const categories = Object.fromEntries(
    Object.entries(Category).map(([name, bit]) => [
      name,
      [...entries.values()].filter((bits) => (bits & bit) !== 0).length,
    ]),
  ) as Record<CategoryName, number>;

  return {
    entries,
    stats: {
      sources,
      onlyIn: countOnlyIn(adultSources),
      categories,
      removedByExceptions,
      total: entries.size,
    },
  };
}

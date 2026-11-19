// What lists/ may hold, and how each file feeds the categories of the compiled filter. See
// lists/README.md and docs/decisions/0039-filter-lists-and-licenses.md.

// Bits of the category byte, read by modules/flust-filter (Categories.kt).
export const Category = {
  adult: 1,
  aiNudify: 2,
  aiCompanions: 4,
  bypass: 8,
  google: 16,
} as const;

export type CategoryName = keyof typeof Category;

export type SourceFile = { name: string; category: CategoryName };

export type Source = { name: string; files: readonly SourceFile[] };

export const SOURCES: readonly Source[] = [
  { name: 'shadowwhisperer', files: [{ name: 'list', category: 'adult' }] },
  { name: 'sinfonietta', files: [{ name: 'list', category: 'adult' }] },
  { name: '4skinskywalker', files: [{ name: 'list', category: 'adult' }] },
  {
    name: 'aegis',
    files: [
      { name: 'ai-adult', category: 'aiNudify' },
      { name: 'vpn', category: 'bypass' },
    ],
  },
];

// flust's own lists. Every entry carries its source and the day it was checked.
export const OWN_LISTS = {
  aiNudify: 'ai-nudify.txt',
  aiCompanions: 'ai-companions.txt',
  bypass: 'bypass.txt',
  google: 'google-domains.txt',
  exceptions: 'exceptions.txt',
} as const;

export const SOURCE_METADATA = ['LICENSE', 'PROVENANCE'] as const;

export const ROOT_ENTRIES = ['README.md', 'sources', 'flust'] as const;

// SPDX identifier, and a sentence its license text always contains.
export const PERMISSIVE_LICENSES: Readonly<Record<string, RegExp>> = {
  MIT: /Permission is hereby granted, free of charge, to any person obtaining a copy/,
  Unlicense: /This is free and unencumbered software released into the public domain/,
  'CC0-1.0': /CC0 1\.0 Universal/,
};

// Copyleft and share-alike terms, which the lists may never carry.
export const COPYLEFT_LICENSE =
  /GNU (Affero |Lesser )?General Public License|Share-?Alike|CC BY-SA/i;

// Lists that must never be committed, compiled or copied: oisd and HaGeZi (GPL-3.0), Bon-Appetit
// (CC BY-SA 4.0), StevenBlack (mixed licenses) and UT1 (too large). Their names in a provenance
// URL or in a comment of any list reveal a copy.
export const EXCLUDED_SOURCES = /\b(oisd|hagezi|bon-?appetit|stevenblack|ut1|ut-capitole)\b/i;

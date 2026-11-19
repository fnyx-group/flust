import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { MIGRATIONS } from '@/data/migrations';

// A published migration has already run on devices: changing it would leave them with a schema
// the code no longer describes. Each one is frozen by the SHA-256 of its source file, line
// endings normalized. A new migration adds its hash here when it is published.
//
// These hashes may be regenerated once, before the first store release, in a dedicated commit
// that says so in its message. Never as part of another change, and never silently.
const PUBLISHED: Record<number, string> = {
  1: '0bee6b9bf48a962a5486f2deeecd8079b6314b1d3e565fc0ec156bc1f85b9158',
  2: '5ea6375297f60c22f1b124398edaa4b6011da05dbd3e64be4ed741f5890558d4',
  3: 'fecbe5dd1af14f064a93e66ee9855ebef5749f2b3dabb70da4c9b5718b3cfb98',
  4: 'a0a5d9ced2189258762c2ebc949533e23ceef7747f56ea325aceea273fb037d4',
  5: '0325d813c09f50947d015c0525ca69bf5854e5527e4655ef88607ddde51378de',
  6: '032c0c030609a415db50aa33ffa24ee309ead3226580e1a3d0ad586292a01490',
};

const directory = __dirname;

function migrationFiles(): Map<number, string> {
  const files = fs.readdirSync(directory).filter((file) => /^\d{4}-[a-z0-9-]+\.ts$/.test(file));
  return new Map(files.map((file) => [Number(file.slice(0, 4)), file]));
}

function hashOf(file: string): string {
  const source = fs.readFileSync(path.join(directory, file), 'utf8').replace(/\r\n/g, '\n');
  return createHash('sha256').update(source).digest('hex');
}

describe('published migrations', () => {
  const files = migrationFiles();

  it('each have one file, named after their version', () => {
    expect([...files.keys()].sort((a, b) => a - b)).toEqual(MIGRATIONS.map((m) => m.version));
  });

  it('each have a recorded hash', () => {
    expect(MIGRATIONS.map((m) => m.version).filter((v) => PUBLISHED[v] === undefined)).toEqual([]);
  });

  it.each(Object.entries(PUBLISHED))('never change (version %s)', (version, hash) => {
    const file = files.get(Number(version));
    expect(file).toBeDefined();
    expect(hashOf(file ?? '')).toBe(hash);
  });
});

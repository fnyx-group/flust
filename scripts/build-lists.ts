// Compiles lists/ into the file the Android filter reads. Run by the filter module's Gradle build,
// or by hand: node scripts/build-lists.ts [--lists <folder>] --out <file>
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { buildLists } from './lists/build.ts';
import { compile } from './lists/compile.ts';

const { values } = parseArgs({
  options: {
    lists: { type: 'string', default: path.join(import.meta.dirname, '..', 'lists') },
    out: { type: 'string' },
  },
});

if (values.out === undefined) {
  console.error('Usage: node scripts/build-lists.ts [--lists <folder>] --out <file>');
  process.exit(2);
}

try {
  const { entries, stats } = buildLists(values.lists);
  const compiled = compile(entries);
  fs.mkdirSync(path.dirname(values.out), { recursive: true });
  fs.writeFileSync(values.out, compiled);
  for (const source of stats.sources) {
    console.log(
      `${source.file}: ${source.entries} domains (${source.category}), ${source.invalid} invalid`,
    );
  }
  for (const [source, count] of Object.entries(stats.onlyIn)) {
    console.log(`only in ${source}: ${count}`);
  }
  for (const [category, count] of Object.entries(stats.categories)) {
    console.log(`category ${category}: ${count}`);
  }
  console.log(`removed by exceptions: ${stats.removedByExceptions}`);
  console.log(`${stats.total} domains, ${compiled.length} bytes, written to ${values.out}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

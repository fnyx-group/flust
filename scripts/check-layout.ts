// Checks `maestro hierarchy` dumps of the layout flows for clipped or overlapping content, and fails
// with one line per problem. With --unscrolled, the first dump is taken before a swipe and the
// second after it, and the check fails when the screen scrolled. Run by scripts/e2e-android.sh
// (docs/decisions/0050-layout-matrix.md), or by hand:
// node scripts/check-layout.ts --width <px> --density <dpi> --status-bar-bottom <px>
//   --navigation-bar-top <px> [--unscrolled] <dump.json> ...
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { layoutProblems, parseHierarchy, scrolled, type Screen } from './layout/rules.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    width: { type: 'string' },
    density: { type: 'string' },
    'status-bar-bottom': { type: 'string' },
    'navigation-bar-top': { type: 'string' },
    unscrolled: { type: 'boolean', default: false },
  },
});

function number(name: keyof typeof values): number {
  const value = Number(values[name]);
  if (!Number.isInteger(value) || value < 0) {
    console.error(`--${name} needs a whole number of pixels or dpi.`);
    process.exit(2);
  }
  return value;
}

const screen: Screen = {
  width: number('width'),
  density: number('density'),
  statusBarBottom: number('status-bar-bottom'),
  navigationBarTop: number('navigation-bar-top'),
};

function read(file: string) {
  return parseHierarchy(fs.readFileSync(file, 'utf8'));
}

let problems: string[];
if (values.unscrolled) {
  const [before, after] = positionals;
  if (before === undefined || after === undefined || positionals.length !== 2) {
    console.error('--unscrolled needs the dump before the swipe and the dump after it.');
    process.exit(2);
  }
  problems = scrolled(read(before), read(after))
    ? [`${path.basename(before)}: the screen scrolls, and it must fit without scrolling`]
    : [];
} else {
  problems = positionals.flatMap((file) =>
    layoutProblems(read(file), screen).map((problem) => `${path.basename(file)}: ${problem}`),
  );
}

for (const problem of problems) console.log(problem);
process.exit(problems.length === 0 ? 0 : 1);

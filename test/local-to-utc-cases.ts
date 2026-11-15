import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { LocalDateTime } from '@/domain/local-time';

export type LocalToUtcCase = { zone: string; local: LocalDateTime; utc: number };

// The cases shared with the Kotlin tests of WallTime (modules/flust-reminders).
export function localToUtcCases(): LocalToUtcCase[] {
  const text = readFileSync(join(__dirname, 'fixtures', 'local-to-utc.tsv'), 'utf8');
  return text
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.startsWith('#'))
    .map((line) => {
      const [zone = '', local = '', utc = ''] = line.split('\t');
      return { zone, local: parseLocal(local), utc: Date.parse(`${utc}Z`) };
    });
}

function parseLocal(text: string): LocalDateTime {
  const [year = 0, month = 0, day = 0, hour = 0, minute = 0] = text.split(/[-T:]/).map(Number);
  return { year, month, day, hour, minute };
}

import {
  ALL_HELP_ENTRIES,
  checkedOnTime,
  dialUrl,
  HELP_DIRECTORY,
  HELP_REGIONS,
  helpEntries,
  helpRegionFor,
  oldestCheck,
  REVIEW_MAX_DAYS,
  reviewDue,
  type HelpEntry,
} from '@/domain/help-resources';
import { MS_PER_DAY } from '@/domain/time';

function numbersOf(entries: readonly HelpEntry[]): string[] {
  return entries.map((entry) => entry.display);
}

describe('helpRegionFor', () => {
  it('maps the listed countries, whatever the case', () => {
    expect(helpRegionFor('FR')).toBe('FR');
    expect(helpRegionFor('fr')).toBe('FR');
    expect(helpRegionFor(' be ')).toBe('BE');
    expect(helpRegionFor('ch')).toBe('CH');
    expect(helpRegionFor('CA')).toBe('CA');
    expect(helpRegionFor('US')).toBe('US');
    expect(helpRegionFor('GB')).toBe('GB');
    expect(helpRegionFor('IE')).toBe('IE');
  });

  it('maps the French overseas departments to France', () => {
    for (const code of ['GP', 'MQ', 'GF', 'RE', 'YT']) expect(helpRegionFor(code)).toBe('FR');
  });

  it('leaves every other or missing region to "other"', () => {
    for (const code of ['LI', 'DE', 'JP', 'UK', 'NC', '', null, undefined]) {
      expect(helpRegionFor(code)).toBe('other');
    }
  });
});

describe('helpEntries', () => {
  it('lists the numbers of each country', () => {
    expect(numbersOf(helpEntries('FR', 'FR'))).toEqual(['3114', '15', '112', '114']);
    expect(numbersOf(helpEntries('BE', 'BE'))).toEqual(['0800 32 123', '1813', '112', '101']);
    expect(numbersOf(helpEntries('CH', 'CH'))).toEqual(['143', '144', '117', '112']);
    expect(numbersOf(helpEntries('CA', 'CA'))).toEqual(['988', '911']);
    expect(numbersOf(helpEntries('US', 'US'))).toEqual(['988', '911']);
    expect(numbersOf(helpEntries('GB', 'GB'))).toEqual(['116 123', '999', '112']);
    expect(numbersOf(helpEntries('IE', 'IE'))).toEqual(['116 123', '112', '999']);
  });

  it('follows the chosen country, not the device region', () => {
    expect(helpEntries('US', 'FR')).toBe(helpEntries('US', 'US'));
  });

  it('names 112 as the official number for other countries of the European Union', () => {
    expect(helpEntries('other', 'DE').map((entry) => entry.id)).toEqual(['eu112']);
    expect(helpEntries('other', 'fr').map((entry) => entry.id)).toEqual(['eu112']);
  });

  it('falls back to 112 elsewhere, or without a region', () => {
    for (const code of ['CH', 'NO', 'JP', null]) {
      expect(helpEntries('other', code).map((entry) => entry.id)).toEqual(['fallback112']);
    }
  });

  it('gives every region at least one emergency number', () => {
    for (const region of HELP_REGIONS) {
      expect(helpEntries(region, null).some((entry) => entry.kind === 'emergency')).toBe(true);
    }
  });
});

describe('help entries', () => {
  it('have unique ids', () => {
    const ids = ALL_HELP_ENTRIES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('write their numbers with digits grouped by single spaces', () => {
    for (const entry of ALL_HELP_ENTRIES) expect(entry.display).toMatch(/^\d+( \d+)*$/);
  });

  it('have at least one action, each listed once', () => {
    for (const entry of ALL_HELP_ENTRIES) {
      expect(entry.actions.length).toBeGreaterThan(0);
      expect(new Set(entry.actions).size).toBe(entry.actions.length);
    }
  });

  // Each text action comes from an official page stating the service answers text messages.
  it('offer text messages only where the service answers them', () => {
    const texting = ALL_HELP_ENTRIES.filter((entry) => entry.actions.includes('text'));
    expect(texting.map((entry) => entry.id).sort()).toEqual(['ca988', 'fr114', 'us988']);
    expect(ALL_HELP_ENTRIES.find((entry) => entry.id === 'fr114')?.actions).toEqual(['text']);
  });
});

// The yearly review: this test fails once a number has not been checked against its official
// source for REVIEW_MAX_DAYS. Check each source again and update checkedOn to fix it.
describe('help resources review', () => {
  const now = Date.now();
  const checks = [...ALL_HELP_ENTRIES, HELP_DIRECTORY];

  it('gives every entry an official https source', () => {
    for (const check of checks) expect(check.source).toMatch(/^https:\/\/[^\s/]+\.[^\s/]+/);
    expect(HELP_DIRECTORY.url).toMatch(/^https:\/\//);
  });

  it('has every entry checked on a real day, not in the future', () => {
    for (const check of checks) {
      const time = checkedOnTime(check.checkedOn);
      expect(time).not.toBeNull();
      expect(time ?? Infinity).toBeLessThanOrEqual(now);
    }
  });

  it(`has every entry checked within ${REVIEW_MAX_DAYS} days`, () => {
    expect(checks.filter((check) => reviewDue(check.checkedOn, now))).toEqual([]);
  });
});

describe('dialUrl', () => {
  const [samaritans] = helpEntries('GB', 'GB');
  const [lifeline] = helpEntries('US', 'US');
  const fr114 = helpEntries('FR', 'FR')[3];

  it('dials the number without spaces', () => {
    expect(samaritans && dialUrl(samaritans, 'call')).toBe('tel:116123');
    expect(lifeline && dialUrl(lifeline, 'call')).toBe('tel:988');
  });

  it('opens a text message for the text action', () => {
    expect(lifeline && dialUrl(lifeline, 'text')).toBe('sms:988');
    expect(fr114 && dialUrl(fr114, 'text')).toBe('sms:114');
  });
});

describe('checkedOnTime', () => {
  it('reads a calendar day as UTC midnight', () => {
    expect(checkedOnTime('2026-11-16')).toBe(Date.UTC(2026, 10, 16));
    expect(checkedOnTime('2024-02-29')).toBe(Date.UTC(2024, 1, 29));
  });

  it('refuses anything that is not a real day', () => {
    for (const value of ['', '2026-11', '2026-13-01', '2025-02-29', '16/11/2026', '2026-11-16Z']) {
      expect(checkedOnTime(value)).toBeNull();
    }
  });
});

describe('reviewDue', () => {
  const checkedOn = '2026-01-01';
  const checked = Date.UTC(2026, 0, 1);

  it('is not due up to the limit', () => {
    expect(reviewDue(checkedOn, checked)).toBe(false);
    expect(reviewDue(checkedOn, checked + REVIEW_MAX_DAYS * MS_PER_DAY)).toBe(false);
  });

  it('is due past the limit', () => {
    expect(reviewDue(checkedOn, checked + REVIEW_MAX_DAYS * MS_PER_DAY + 1)).toBe(true);
    expect(reviewDue(checkedOn, checked + (REVIEW_MAX_DAYS + 1) * MS_PER_DAY)).toBe(true);
  });

  it('is due when the day cannot be read', () => {
    expect(reviewDue('soon', checked)).toBe(true);
  });
});

describe('oldestCheck', () => {
  it('returns the earliest day, or null without checks', () => {
    expect(
      oldestCheck([
        { checkedOn: '2026-11-16' },
        { checkedOn: '2026-03-02' },
        { checkedOn: '2026-07-30' },
      ]),
    ).toBe('2026-03-02');
    expect(oldestCheck([])).toBeNull();
  });
});

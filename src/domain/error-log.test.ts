import * as fc from 'fast-check';

import {
  appendEntries,
  formatReport,
  isErrorEntry,
  MAX_ENTRIES,
  MAX_FRAMES,
  parseStack,
  routeFromName,
  toEntry,
  type ErrorEntry,
} from '@/domain/error-log';

const AT = Date.UTC(2026, 10, 16, 9, 30);

function entry(overrides: Partial<ErrorEntry> = {}): ErrorEntry {
  return { at: AT, kind: 'render', route: null, name: null, code: null, frames: [], ...overrides };
}

function errorWith(message: string, stack: string, name = 'TypeError'): Error {
  const error = new Error(message);
  error.name = name;
  error.stack = stack;
  return error;
}

describe('toEntry', () => {
  it('keeps the kind, the route, the name, the code and the frames, never the message', () => {
    const error = errorWith(
      'Cannot read note "I relapsed at the gym"',
      [
        'TypeError: Cannot read note "I relapsed at the gym"',
        '    at render (address at index.android.bundle:1:23456)',
      ].join('\n'),
    );

    const result = toEntry({
      at: AT,
      kind: 'render',
      error,
      route: '/note',
      code: 'storage-failed',
    });

    expect(result).toEqual({
      at: AT,
      kind: 'render',
      route: '/note',
      name: 'TypeError',
      code: 'storage-failed',
      frames: ['render@index.android.bundle:1:23456'],
    });
    expect(JSON.stringify(result)).not.toContain('gym');
  });

  it('drops a name, a route or a code that could carry text', () => {
    const error = errorWith('x', '', 'My reason is my daughter');

    const result = toEntry({
      at: AT,
      kind: 'render',
      error,
      route: '/note?title=My secret',
      code: 'Lapse at 3am with Alex',
    });

    expect(result.name).toBeNull();
    expect(result.route).toBeNull();
    expect(result.code).toBeNull();
  });

  it('records a value that is not an Error with no name and no frames', () => {
    const result = toEntry({ at: AT, kind: 'unhandled-rejection', error: 'my plan: call Sam' });

    expect(result).toEqual(entry({ kind: 'unhandled-rejection' }));
  });

  it('records a storage failure by its code alone', () => {
    const result = toEntry({ at: AT, kind: 'storage-failure', code: 'key-unavailable' });

    expect(result).toEqual(entry({ kind: 'storage-failure', code: 'key-unavailable' }));
  });

  it('never keeps any character of a message, whatever it holds', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 12 }), (message) => {
        const marker = `zq${message}`;
        const error = errorWith(marker, `Error: ${marker}\n    at f (file.js:1:2)`);
        const result = toEntry({ at: AT, kind: 'fatal', error });
        expect(JSON.stringify(result)).not.toContain(JSON.stringify(marker).slice(1, -1));
        expect(isErrorEntry(result)).toBe(true);
      }),
    );
  });
});

describe('routes', () => {
  it('names a route by its screen, with parameters as written in the file name', () => {
    expect(routeFromName('index')).toBe('/index');
    expect(routeFromName('journal')).toBe('/journal');
    expect(routeFromName('(tabs)')).toBe('/(tabs)');
    expect(routeFromName('note/[id]')).toBe('/note/[id]');

    expect(toEntry({ at: AT, kind: 'render', route: '/note/[id]' }).route).toBe('/note/[id]');
    expect(toEntry({ at: AT, kind: 'render', route: '/' }).route).toBe('/');
  });

  it.each([
    ['/note/12345'],
    ['/note/7'],
    ['/reason/3f9a2c71'],
    ['/reason/a1b2c3d4e5'],
    ['/plan/550e8400-e29b-41d4-a716-446655440000'],
    ['/plan/averyveryverylongsegmentname'],
    ['/note//journal'],
    ['/Note'],
    ['note'],
    [`/${'a/'.repeat(41)}a`],
  ])('drops %p, which could carry an id, a token or text', (route) => {
    expect(toEntry({ at: AT, kind: 'render', route }).route).toBeNull();
    expect(isErrorEntry(entry({ route }))).toBe(false);
  });
});

describe('parseStack', () => {
  it('reads Hermes, V8 and development bundle frames as function, file, line and column', () => {
    const stack = [
      'Error: message',
      '    at render (address at index.android.bundle:1:23456)',
      '    at Object.<anonymous> (/home/someone/flust/src/features/home.tsx:10:5)',
      '    at ?anon_0_ (http://10.0.2.2:8081/index.bundle?platform=android&dev=true:120:7)',
      '    at /home/someone/flust/main.js:3:9',
      '    at native',
    ].join('\n');

    expect(parseStack(stack)).toEqual([
      'render@index.android.bundle:1:23456',
      'Object.<anonymous>@home.tsx:10:5',
      '?anon_0_@index.bundle:120:7',
      '?@main.js:3:9',
    ]);
  });

  it('skips frames whose file name is not a plain file name', () => {
    expect(parseStack('    at f (my notes.txt:1:2)')).toEqual([]);
  });

  it('keeps at most the first frames', () => {
    const stack = Array.from({ length: 40 }, (_, index) => `    at f${index} (a.js:1:${index})`);

    const frames = parseStack(stack.join('\n'));

    expect(frames).toHaveLength(MAX_FRAMES);
    expect(frames[0]).toBe('f0@a.js:1:0');
  });
});

describe('appendEntries', () => {
  it('keeps the last entries', () => {
    const entries = Array.from({ length: MAX_ENTRIES }, (_, index) => entry({ at: index }));

    const result = appendEntries(entries, [entry({ at: 999 })]);

    expect(result).toHaveLength(MAX_ENTRIES);
    expect(result[0]?.at).toBe(1);
    expect(result.at(-1)?.at).toBe(999);
  });
});

describe('isErrorEntry', () => {
  it('accepts an entry made by toEntry', () => {
    const error = errorWith('m', '    at f (a.js:1:2)');
    expect(isErrorEntry(toEntry({ at: AT, kind: 'fatal', error, route: '/' }))).toBe(true);
  });

  it.each([
    ['not an object', 'entry'],
    ['an unknown kind', { ...entry(), kind: 'crash' }],
    ['a time that is not an integer', { ...entry(), at: 1.5 }],
    ['a message', { ...entry(), message: 'my journal' }],
    ['a name with spaces', { ...entry(), name: 'my journal' }],
    ['a route with text', { ...entry(), route: 'my journal' }],
    ['a code with text', { ...entry(), code: 'My journal' }],
    ['a frame with text', { ...entry(), frames: ['my journal'] }],
    ['frames that are not a list', { ...entry(), frames: 'a@b.js:1:2' }],
    ['too many frames', { ...entry(), frames: Array(MAX_FRAMES + 1).fill('f@a.js:1:2') }],
  ])('rejects %s', (_label, value) => {
    expect(isErrorEntry(value)).toBe(false);
  });
});

describe('formatReport', () => {
  const meta = { now: AT, version: '0.1.0', platform: 'android', osVersion: '35' };

  it('lists the device, the app version and each entry with its details', () => {
    const report = formatReport(
      [
        entry({
          route: '/note',
          name: 'TypeError',
          frames: ['render@index.android.bundle:1:2'],
        }),
        entry({ at: AT + 1000, kind: 'storage-failure', code: 'key-unavailable' }),
      ],
      meta,
    );

    expect(report).toBe(
      [
        'flust error report',
        'Created: 2026-11-16T09:30:00.000Z',
        'App: 0.1.0',
        'System: android 35',
        'Entries: 2',
        '',
        '1. 2026-11-16T09:30:00.000Z',
        '   Kind: render',
        '   Screen: /note',
        '   Error: TypeError',
        '   at render@index.android.bundle:1:2',
        '',
        '2. 2026-11-16T09:30:01.000Z',
        '   Kind: storage-failure',
        '   Code: key-unavailable',
      ].join('\n'),
    );
  });

  it('says when the version or a time is unknown', () => {
    const report = formatReport([entry({ at: Number.MAX_SAFE_INTEGER })], {
      ...meta,
      version: null,
    });

    expect(report).toContain('App: unknown');
    expect(report).toContain('1. unknown time');
  });
});

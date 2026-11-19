import { normalizeDomain, ownLine, sourceLineName, withParents } from './domains';

describe('normalizeDomain', () => {
  it('lowercases and drops the trailing dot', () => {
    expect(normalizeDomain(' Video.Example.COM. ')).toBe('video.example.com');
  });

  it('converts internationalized names to Punycode', () => {
    expect(normalizeDomain('bücher.example')).toBe('xn--bcher-kva.example');
  });

  it.each([
    ['an IPv4 address', '85.17.187.83'],
    ['a single label', 'localhost'],
    ['a wildcard', '*.example.com'],
    ['a space inside', 'exa mple.com'],
    ['a label starting with a hyphen', '-bad.example.com'],
    ['a label over 63 characters', `${'a'.repeat(64)}.example`],
    ['an empty label', 'a..example'],
    ['nothing', ''],
  ])('rejects %s', (_, raw) => {
    expect(normalizeDomain(raw)).toBeNull();
  });

  it('keeps underscores, which some hosts carry', () => {
    expect(normalizeDomain('_dmarc.example.com')).toBe('_dmarc.example.com');
  });
});

describe('sourceLineName', () => {
  it.each([
    ['example.com', 'example.com'],
    ['0.0.0.0 example.com', 'example.com'],
    ['127.0.0.1\texample.com # note', 'example.com'],
    [':: example.com', 'example.com'],
    ['# a comment', null],
    ['   ', null],
  ])('reads %j', (line, name) => {
    expect(sourceLineName(line)).toBe(name);
  });
});

describe('ownLine', () => {
  it('reads the domain, its source and the day it was checked', () => {
    expect(ownLine('cloth-off.io    # aegis ai-adult, checked 2026-11-19')).toEqual({
      name: 'cloth-off.io',
      source: 'aegis ai-adult',
      checked: '2026-11-19',
    });
  });

  it('keeps commas inside the source', () => {
    expect(ownLine('proton.me # aegis vpn, Proton Mail, checked 2026-11-19')).toMatchObject({
      source: 'aegis vpn, Proton Mail',
    });
  });

  it('skips blank and comment lines', () => {
    expect(ownLine('')).toBeNull();
    expect(ownLine('# Header')).toBeNull();
  });

  it.each(['cloth-off.io', 'cloth-off.io # aegis', 'cloth-off.io # aegis, checked yesterday'])(
    'rejects an entry without its source and date: %j',
    (line) => {
      expect(ownLine(line)).toBe('invalid');
    },
  );
});

describe('withParents', () => {
  it('lists the name and its parents down to two labels', () => {
    expect(withParents('a.b.example.com')).toEqual([
      'a.b.example.com',
      'b.example.com',
      'example.com',
    ]);
    expect(withParents('example.com')).toEqual(['example.com']);
  });
});

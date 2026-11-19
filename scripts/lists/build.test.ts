import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildLists } from './build';
import { compile } from './compile';
import { Category } from './layout';

const fixtures = path.join(__dirname, '..', '..', 'test', 'fixtures');
const fixture = path.join(fixtures, 'filter-lists');

describe('buildLists', () => {
  const { entries, stats } = buildLists(fixture);

  it('normalizes the names of every source', () => {
    expect(entries.get('video.adult-two.example')).toBe(Category.adult);
    expect(entries.get('xn--bcher-kva.example')).toBe(Category.adult);
    expect(stats.sources.find((source) => source.file === 'sinfonietta/list')).toEqual({
      file: 'sinfonietta/list',
      category: 'adult',
      entries: 1,
      invalid: 1,
    });
  });

  it('moves AI companions out of AI nudify', () => {
    expect(entries.get('companion.example')).toBe(Category.aiCompanions);
    expect(entries.get('nudify.example')).toBe(Category.aiNudify);
    expect(entries.get('deepfake.example')).toBe(Category.aiNudify);
  });

  it('removes an exception and every name under it', () => {
    expect(entries.has('safe.excepted.example')).toBe(false);
    expect(entries.has('antivirus.example')).toBe(false);
    expect(stats.removedByExceptions).toBe(2);
  });

  it('keeps the bypass names and the Google domains', () => {
    expect(entries.get('use-application-dns.net')).toBe(Category.bypass);
    expect(entries.get('vpn.example')).toBe(Category.bypass);
    expect(entries.get('google.fr')).toBe(Category.google);
  });

  it('counts the domains each adult source alone lists', () => {
    expect(stats.onlyIn).toEqual({ shadowwhisperer: 2, sinfonietta: 1, '4skinskywalker': 3 });
  });

  // The Kotlin tests read the committed file: both sides must agree on it.
  it('compiles to the committed fixture', () => {
    const committed = fs.readFileSync(path.join(fixtures, 'filter-lists.bin'));

    expect(compile(entries).equals(committed)).toBe(true);
  });

  it('refuses lists that fail the check', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'filter-lists-'));
    try {
      fs.cpSync(fixture, root, { recursive: true });
      fs.rmSync(path.join(root, 'sources/aegis/LICENSE'));

      expect(() => buildLists(root)).toThrow('sources/aegis: no LICENSE file');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses an exception under a name that stays blocked', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'filter-lists-'));
    try {
      fs.cpSync(fixture, root, { recursive: true });
      fs.appendFileSync(
        path.join(root, 'flust/exceptions.txt'),
        'video.adult-two.example # fixture, checked 2026-11-19\n',
      );

      expect(() => buildLists(root)).toThrow(
        'Exceptions under a name that stays blocked: video.adult-two.example',
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses a domain in both AI nudify and AI companions', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'filter-lists-'));
    try {
      fs.cpSync(fixture, root, { recursive: true });
      fs.appendFileSync(
        path.join(root, 'flust/ai-nudify.txt'),
        'companion.example # fixture, checked 2026-11-19\n',
      );

      expect(() => buildLists(root)).toThrow('Both AI nudify and AI companions: companion.example');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('the committed lists', () => {
  const { entries } = buildLists(path.join(__dirname, '..', '..', 'lists'));

  it('build without a problem or a hash collision', () => {
    expect(() => compile(entries)).not.toThrow();
    expect(entries.size).toBeGreaterThan(100_000);
  });

  // aegis's ai-adult list brings them, so flust/ai-nudify.txt holds only the names no source has.
  it.each([
    'cloth-off.io',
    'cloth-off.ai',
    'clothoff.info',
    'clothes-remover.com',
    'undressai.io',
    'drawnudes.com',
    'deepnude.to',
    'deepnudeapp.com',
    'deepfakesweb.com',
    'nudify.cc',
    'ai-nudes.com',
    'ainudes.com',
    'nsfwgen.com',
    'xpictures.io',
  ])('block %s under AI nudify', (name) => {
    expect(entries.get(name)! & Category.aiNudify).toBe(Category.aiNudify);
  });

  // Sites whose main purpose is adult content are blocked, not general platforms that hold some.
  it.each(['vk.com', 'ok.ru', '4chan.org', '9gag.com', 'deviantart.com', 'www.deviantart.com'])(
    'leave the general platform %s open',
    (name) => {
      expect(entries.has(name)).toBe(false);
    },
  );

  // flust reaches Quad9 by address, so strict mode can block its name for every app.
  it('block the names of DoH providers in strict mode, Quad9 included', () => {
    for (const name of ['dns.quad9.net', 'dns.google', 'use-application-dns.net']) {
      expect(entries.get(name)! & Category.bypass).toBe(Category.bypass);
    }
  });
});

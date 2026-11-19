import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { checkLists } from './check';

const fixture = path.join(__dirname, '..', '..', 'test', 'fixtures', 'filter-lists');
const lists = path.join(__dirname, '..', '..', 'lists');

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'filter-lists-'));
  fs.cpSync(fixture, root, { recursive: true });
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function write(file: string, content: string) {
  fs.writeFileSync(path.join(root, file), content);
}

function edit(file: string, change: (text: string) => string) {
  write(file, change(fs.readFileSync(path.join(root, file), 'utf8')));
}

// Keeps the recorded checksum in step, so a test sees only the problem it adds.
function rewriteList(source: string, name: string, content: string) {
  write(`sources/${source}/${name}`, content);
  const sha256 = createHash('sha256').update(content).digest('hex');
  edit(`sources/${source}/PROVENANCE`, (text) =>
    text.replace(new RegExp(`( ${name} sha256:)[0-9a-f]{64}`), `$1${sha256}`),
  );
}

describe('checkLists', () => {
  it('accepts the committed lists', () => {
    expect(checkLists(lists)).toEqual([]);
  });

  it('accepts the fixture', () => {
    expect(checkLists(root)).toEqual([]);
  });

  it('fails on a source without a license file', () => {
    fs.rmSync(path.join(root, 'sources/sinfonietta/LICENSE'));

    expect(checkLists(root)).toEqual(['sources/sinfonietta: no LICENSE file']);
  });

  it('fails on a license outside MIT, Unlicense and CC0', () => {
    edit('sources/sinfonietta/PROVENANCE', (text) =>
      text.replace('license: MIT', 'license: GPL-3.0'),
    );

    expect(checkLists(root)).toEqual([
      'sources/sinfonietta: license GPL-3.0 is not one of MIT, Unlicense, CC0-1.0',
    ]);
  });

  it('fails on copyleft terms in the license text', () => {
    write('sources/aegis/LICENSE', 'CC0 1.0 Universal\nGNU General Public License\n');

    expect(checkLists(root)).toEqual(['sources/aegis/LICENSE: copyleft or share-alike terms']);
  });

  it('fails on a license text that is not the one declared', () => {
    write('sources/sinfonietta/LICENSE', 'CC0 1.0 Universal\n');

    expect(checkLists(root)).toEqual(['sources/sinfonietta/LICENSE: does not read as MIT']);
  });

  it('fails on a provenance pointing to an excluded list', () => {
    edit('sources/aegis/PROVENANCE', (text) =>
      text.replace(/^url: .*$/m, 'url: https://github.com/hagezi/dns-blocklists'),
    );

    expect(checkLists(root)).toEqual([
      'sources/aegis/PROVENANCE: excluded source in "url: https://github.com/hagezi/dns-blocklists"',
    ]);
  });

  it('fails on a file of the provenance taken from an excluded list', () => {
    edit('sources/aegis/PROVENANCE', (text) =>
      text.replace(/^file: \S+ vpn /m, 'file: hagezi/doh-vpn-proxy-bypass.txt vpn '),
    );

    expect(checkLists(root)).toEqual([
      expect.stringMatching(
        /^sources\/aegis\/PROVENANCE: excluded source in "file: hagezi\/doh-vpn-proxy-bypass\.txt vpn sha256:[0-9a-f]{64}"$/,
      ),
    ]);
  });

  it.each(['oisd', 'HaGeZi', 'StevenBlack', 'Bon-Appetit', 'UT1'])(
    'fails on a source list that names %s',
    (name) => {
      rewriteList('shadowwhisperer', 'list', `# Title: ${name} NSFW\nadult.example\n`);

      expect(checkLists(root)).toEqual(['sources/shadowwhisperer/list: names an excluded list']);
    },
  );

  it('fails on an entry of our own lists that names an excluded list', () => {
    write('flust/bypass.txt', 'doh.example # hagezi doh list, checked 2026-11-19\n');

    expect(checkLists(root)).toEqual(['flust/bypass.txt: names an excluded list']);
  });

  it('fails on a list whose checksum does not match its provenance', () => {
    write('sources/sinfonietta/list', '0.0.0.0 other.example\n');

    expect(checkLists(root)).toEqual(['sources/sinfonietta/list: checksum does not match']);
  });

  it('fails on a missing provenance', () => {
    fs.rmSync(path.join(root, 'sources/sinfonietta/PROVENANCE'));

    expect(checkLists(root)).toEqual([
      'sources/sinfonietta: license (none) is not one of MIT, Unlicense, CC0-1.0',
      'sources/sinfonietta: no PROVENANCE file',
    ]);
  });

  it('fails on a provenance without its commit or date', () => {
    edit('sources/aegis/PROVENANCE', (text) =>
      text.replace(/^commit: .*$/m, 'commit: main').replace(/^date: .*$/m, 'date: today'),
    );

    expect(checkLists(root)).toEqual([
      'sources/aegis/PROVENANCE: no commit',
      'sources/aegis/PROVENANCE: no date',
    ]);
  });

  it('fails on files outside the layout', () => {
    write('sources/aegis/porn', 'adult.example\n');
    fs.mkdirSync(path.join(root, 'sources/oisd'));
    write('flust/extra.txt', '');
    write('notes.txt', '');

    expect(checkLists(root)).toEqual([
      'lists/notes.txt: not part of the lists layout',
      'lists/sources/oisd: not part of the lists layout',
      'lists/flust/extra.txt: not part of the lists layout',
      'sources/aegis/porn: not part of the lists layout',
    ]);
  });

  it('fails on an entry of our own lists with an empty source', () => {
    write('flust/ai-nudify.txt', 'deepfake.example # , checked 2026-11-19\n');

    expect(checkLists(root)).toEqual([
      'flust/ai-nudify.txt:1: expected "domain  # source, checked YYYY-MM-DD"',
    ]);
  });

  it('fails on an entry of our own lists without its source and date', () => {
    write('flust/ai-nudify.txt', '# Header\ndeepfake.example\n');

    expect(checkLists(root)).toEqual([
      'flust/ai-nudify.txt:2: expected "domain  # source, checked YYYY-MM-DD"',
    ]);
  });

  it('fails on an entry of our own lists that is not a lowercase ASCII domain', () => {
    write('flust/ai-nudify.txt', 'Deepfake.example # fixture, checked 2026-11-19\n');

    expect(checkLists(root)).toEqual([
      'flust/ai-nudify.txt:1: Deepfake.example is not a lowercase ASCII domain',
    ]);
  });
});

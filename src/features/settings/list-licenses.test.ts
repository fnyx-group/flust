import fs from 'node:fs';
import path from 'node:path';

import { LIST_LICENSES } from '@/features/settings/list-licenses';

const sources = path.join(__dirname, '..', '..', '..', 'lists', 'sources');

describe('the list licenses', () => {
  it('cover every source of the lists', () => {
    const folders = fs
      .readdirSync(sources, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    expect(LIST_LICENSES.map((license) => license.source).sort()).toEqual(folders.sort());
  });

  it.each(LIST_LICENSES)('match the license file of $source', ({ source, text }) => {
    expect(text).toBe(fs.readFileSync(path.join(sources, source, 'LICENSE'), 'utf8'));
  });

  it.each(LIST_LICENSES)('name the license recorded in the provenance of $source', (entry) => {
    const provenance = fs.readFileSync(path.join(sources, entry.source, 'PROVENANCE'), 'utf8');

    expect(provenance).toMatch(new RegExp(`^license: ${entry.license}$`, 'm'));
  });
});

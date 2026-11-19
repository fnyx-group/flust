import { execFileSync } from 'node:child_process';
import path from 'node:path';

const fixtures = path.join(__dirname, '..', 'test', 'fixtures', 'xmltree');

// Each fixture is the `aapt2 dump xmltree` output of an APK built from a small manifest with
// `aapt2 link`.
function schemesIn(fixture: string): string[] {
  const output = execFileSync(
    'awk',
    ['-f', path.join(__dirname, 'url-schemes.awk'), path.join(fixtures, `${fixture}.xmltree`)],
    { encoding: 'utf8' },
  );
  return output.split('\n').filter((line) => line !== '');
}

describe('url-schemes.awk', () => {
  it('finds nothing in a manifest whose only VIEW action is a web link query', () => {
    expect(schemesIn('clean')).toEqual([]);
  });

  it('finds a literal scheme', () => {
    expect(schemesIn('literal-scheme')).toEqual(['flust']);
  });

  it('finds a scheme given as a resource reference', () => {
    expect(schemesIn('resource-scheme')).toEqual(['@0x7f010000']);
  });

  it('counts an action given as a resource reference as VIEW', () => {
    expect(schemesIn('resource-action')).toEqual(['flust-action']);
  });

  it('finds a scheme on an activity alias', () => {
    expect(schemesIn('activity-alias')).toEqual(['flust-alias']);
  });

  it('finds every scheme of a filter with several data elements, and only VIEW filters', () => {
    expect(schemesIn('several-data')).toEqual(['flust-one', 'flust-two']);
  });
});

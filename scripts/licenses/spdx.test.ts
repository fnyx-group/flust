import { spdxOfPom } from './spdx';

describe('the license of a POM', () => {
  it.each([
    ['The Apache Software License, Version 2.0', 'http://www.apache.org/licenses/LICENSE-2.0.txt'],
    ['Apache License, Version 2.0', ''],
    ['Apache 2.0', ''],
    ['APACHE-2', 'https://github.com/facebookincubator/fbjni/blob/main/LICENSE'],
    ['Apache-2', ''],
    ['Apache-2.0', ''],
  ])('reads %s as Apache-2.0', (name, url) => {
    expect(spdxOfPom([{ name, url }])).toBe('Apache-2.0');
  });

  it.each(['MIT', 'MIT License', 'The MIT License', 'MIT license'])('reads %s as MIT', (name) => {
    expect(spdxOfPom([{ name, url: '' }])).toBe('MIT');
  });

  // A URL to the Apache text does not make Apache-2.0 of a license whose name adds terms to it.
  it.each([
    ['Some name', 'https://www.apache.org/licenses/LICENSE-2.0'],
    ['Apache 2.0 with Commons Clause', 'https://www.apache.org/licenses/LICENSE-2.0'],
    ['Elastic License 2.0', 'https://www.apache.org/licenses/LICENSE-2.0.txt'],
  ])('knows nothing of %s, whatever its URL', (name, url) => {
    expect(spdxOfPom([{ name, url }])).toBeNull();
  });

  it('knows nothing of a license whose name and URL disagree', () => {
    expect(
      spdxOfPom([{ name: 'MIT', url: 'https://www.apache.org/licenses/LICENSE-2.0' }]),
    ).toBeNull();
    expect(
      spdxOfPom([{ name: 'Apache 2.0', url: 'https://opensource.org/licenses/MIT' }]),
    ).toBeNull();
  });

  it('reads a name and a URL that agree', () => {
    expect(spdxOfPom([{ name: 'MIT License', url: 'https://opensource.org/licenses/MIT' }])).toBe(
      'MIT',
    );
  });

  it('reads several licenses as a choice', () => {
    expect(
      spdxOfPom([
        { name: 'MIT', url: '' },
        { name: 'Apache 2.0', url: '' },
      ]),
    ).toBe('(MIT OR Apache-2.0)');
  });

  it('knows nothing of a missing or unknown license', () => {
    expect(spdxOfPom([])).toBeNull();
    expect(spdxOfPom([{ name: 'BSD License', url: 'https://example.org/LICENSE' }])).toBeNull();
    expect(
      spdxOfPom([
        { name: 'MIT', url: '' },
        { name: 'GPL', url: '' },
      ]),
    ).toBeNull();
  });
});

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

  it('reads the URL when the name is unusual', () => {
    expect(
      spdxOfPom([{ name: 'Some name', url: 'https://www.apache.org/licenses/LICENSE-2.0' }]),
    ).toBe('Apache-2.0');
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

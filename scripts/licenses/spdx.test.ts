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

  // A URL is recognised when it contradicts the name: the entry is then read as unknown.
  describe('the URL of a license text', () => {
    const APACHE_URLS = [
      'http://www.apache.org/licenses/LICENSE-2.0.txt',
      'https://www.apache.org/licenses/LICENSE-2.0',
      'https://apache.org/licenses/LICENSE-2.0.html',
      'www.apache.org/licenses/LICENSE-2.0/',
      'apache.org/licenses/LICENSE-2.0',
      ' https://www.apache.org/licenses/LICENSE-2.0 ',
    ];
    const MIT_URLS = [
      'https://opensource.org/licenses/MIT',
      'http://www.opensource.org/licenses/mit',
      'https://opensource.org/licenses/MIT.html',
      'https://opensource.org/licenses/MIT/',
    ];

    it.each(APACHE_URLS)('reads %s as the Apache text', (url) => {
      expect(spdxOfPom([{ name: 'MIT', url }])).toBeNull();
    });

    it.each(MIT_URLS)('reads %s as the MIT text', (url) => {
      expect(spdxOfPom([{ name: 'Apache 2.0', url }])).toBeNull();
    });

    it.each([
      'https://evil.example/www.apache.org/licenses/LICENSE-2.0',
      'https://apache.org.evil.example/licenses/LICENSE-2.0',
      'https://notapache.org/licenses/LICENSE-2.0',
      'ftp://www.apache.org/licenses/LICENSE-2.0',
      'https://www.apache.org/licenses/LICENSE-2.0-with-commons-clause',
      'https://www.apache.org/licenses/LICENSE-2.0.txt#commons-clause',
      'https://www.apache.org/licenses/LICENSE-2.0?extra=terms',
      'https://www.apache.org/licenses/LICENSE-2.0 and https://example.org/extra',
    ])('does not read %s as the Apache text', (url) => {
      expect(spdxOfPom([{ name: 'MIT', url }])).toBe('MIT');
    });

    it.each([
      'https://evil.example/opensource.org/licenses/MIT',
      'https://opensource.org.evil.example/licenses/MIT',
      'https://opensource.org/licenses/MIT-0',
      'https://opensource.org/licenses/mit-cmu',
      'https://example.org/?u=https://opensource.org/licenses/MIT',
    ])('does not read %s as the MIT text', (url) => {
      expect(spdxOfPom([{ name: 'Apache 2.0', url }])).toBe('Apache-2.0');
    });
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

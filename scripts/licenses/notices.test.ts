import { assemble, problemsOf, type Shipped } from './notices';

const MIT = 'MIT License\n\nCopyright (c) 2024 Someone\n\nPermission is hereby granted...';
const APACHE = 'Apache License\nVersion 2.0, January 2004\n...';

function shipped(overrides: Partial<Shipped> = {}): Shipped {
  return { key: 'npm:a', name: 'a', version: '1.0.0', license: 'MIT', text: MIT, ...overrides };
}

describe('a shipped dependency', () => {
  it('passes with an allowed license, its text and a version', () => {
    expect(problemsOf(shipped())).toEqual([]);
    expect(problemsOf(shipped({ license: 'Apache-2.0', text: APACHE }))).toEqual([]);
  });

  it('fails without a license text', () => {
    expect(problemsOf(shipped({ text: '  \n' }))).toEqual(['npm:a: no license text']);
  });

  it('fails under a license that is not allowed', () => {
    expect(problemsOf(shipped({ license: 'GPL-3.0-only' }))).toEqual([
      'npm:a: license GPL-3.0-only is not allowed',
    ]);
  });

  it('fails on a notice license without its copyright line', () => {
    expect(problemsOf(shipped({ text: 'Permission is hereby granted...' }))).toEqual([
      'npm:a: the MIT text has no copyright line',
    ]);
  });

  it('fails on an expression it cannot read, or without a version', () => {
    expect(problemsOf(shipped({ license: '(MIT' }))).toEqual([
      'npm:a: Unbalanced license expression: (MIT',
    ]);
    expect(problemsOf(shipped({ version: '' }))).toEqual(['npm:a: no version']);
  });
});

describe('the notices', () => {
  it('sort the libraries and share identical texts', () => {
    const { notices, problems } = assemble([
      shipped({ key: 'npm:b', name: 'b' }),
      shipped(),
      shipped({ key: 'maven:x:y', name: 'x:y', license: 'Apache-2.0', text: APACHE }),
    ]);

    expect(problems).toEqual([]);
    expect(notices.libraries.map((library) => library.name)).toEqual(['a', 'b', 'x:y']);
    expect(Object.keys(notices.texts)).toHaveLength(2);
    expect(notices.libraries[0]?.text).toBe(notices.libraries[1]?.text);
  });

  it('list a package shipped as JavaScript and as native code once', () => {
    const { notices } = assemble([shipped(), shipped({ key: 'npm:a (APK)' })]);

    expect(notices.libraries).toHaveLength(1);
  });

  it('keep two versions of a package apart', () => {
    const { notices } = assemble([shipped(), shipped({ version: '2.0.0' })]);

    expect(notices.libraries.map((library) => library.version)).toEqual(['1.0.0', '2.0.0']);
  });

  it('report the same version with two different licenses', () => {
    const { problems } = assemble([shipped(), shipped({ key: 'maven:a', license: 'ISC' })]);

    expect(problems).toEqual(['maven:a: differs from npm:a for the same version']);
  });
});

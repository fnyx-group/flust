import { licenseAllowed } from './allowed';

describe('the allowed licenses', () => {
  it.each(['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC', 'MPL-2.0', 'CC0-1.0', 'blessing'])(
    'allow %s',
    (license) => {
      expect(licenseAllowed(license, 'some-package')).toBe(true);
    },
  );

  it.each([
    'GPL-2.0',
    'GPL-3.0-only',
    'LGPL-2.1',
    'AGPL-3.0',
    'CC-BY-4.0',
    'CC-BY-SA-4.0',
    'UNKNOWN',
  ])('refuse %s', (license) => {
    expect(licenseAllowed(license, 'some-package')).toBe(false);
  });

  it('allows a choice when one side is allowed', () => {
    expect(licenseAllowed('(BSD-3-Clause OR GPL-2.0)', 'node-forge')).toBe(true);
    expect(licenseAllowed('GPL-2.0 OR LGPL-2.1', 'a')).toBe(false);
  });

  it('allows a combination only when every part is allowed', () => {
    expect(licenseAllowed('MIT AND Apache-2.0', 'a')).toBe(true);
    expect(licenseAllowed('MIT AND GPL-2.0', 'a')).toBe(false);
  });

  it('reads AND before OR', () => {
    expect(licenseAllowed('GPL-2.0 OR MIT AND ISC', 'a')).toBe(true);
    expect(licenseAllowed('MIT OR GPL-2.0 AND ISC', 'a')).toBe(true);
    expect(licenseAllowed('(MIT OR GPL-2.0) AND GPL-3.0', 'a')).toBe(false);
  });

  it('keeps OFL-1.1 for the font packages', () => {
    expect(licenseAllowed('MIT AND OFL-1.1', '@expo-google-fonts/manrope')).toBe(true);
    expect(licenseAllowed('MIT AND OFL-1.1', 'some-package')).toBe(false);
  });

  it('allows the LLVM exception only', () => {
    expect(licenseAllowed('Apache-2.0 WITH LLVM-exception', 'libc++')).toBe(true);
    expect(licenseAllowed('GPL-2.0 WITH Classpath-exception-2.0', 'a')).toBe(false);
  });

  it('fails on an expression it cannot read', () => {
    expect(() => licenseAllowed('(MIT', 'a')).toThrow('Unbalanced');
    expect(() => licenseAllowed('MIT AND', 'a')).toThrow('Malformed');
    expect(() => licenseAllowed('MIT ISC', 'a')).toThrow('Malformed');
  });
});

// The licenses flust may ship a dependency under (docs/decisions/0043-third-party-licenses.md).
// Permissive licenses, MPL-2.0 like flust itself, and the public domain. Copyleft that would bind
// the app, GPL, LGPL and AGPL, and attribution-only content licenses such as CC-BY stay out.
export const ALLOWED_LICENSES: readonly string[] = [
  '0BSD',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'BSL-1.0',
  'CC0-1.0',
  'ISC',
  'MIT',
  'MPL-2.0',
  'Unlicense',
  'Zlib',
  'blessing',
  // libjpeg-turbo, in Fresco's image transcoder: permissive, asks for an acknowledgement.
  'IJG',
  'OFL-1.1',
];

// OFL-1.1 covers fonts, not code: only the font packages may use it.
const FONT_LICENSE = 'OFL-1.1';
const FONT_PACKAGE = /^@expo-google-fonts\//;

const ALLOWED_EXCEPTIONS: readonly string[] = ['LLVM-exception'];

type Token = string;

function tokenize(expression: string): Token[] {
  return expression
    .replace(/([()])/g, ' $1 ')
    .split(/\s+/)
    .filter((token) => token !== '');
}

// SPDX expressions: identifiers joined by AND and OR, with WITH for an exception and parentheses.
// AND binds tighter than OR. A choice passes when one side passes; a combination when every part
// does.
export function licenseAllowed(expression: string, packageName: string): boolean {
  const tokens = tokenize(expression);
  let position = 0;

  function identifier(): boolean {
    const token = tokens[position];
    position += 1;
    if (token === '(') {
      const value = or();
      if (tokens[position] !== ')') throw new Error(`Unbalanced license expression: ${expression}`);
      position += 1;
      return value;
    }
    if (token === undefined || token === ')' || /^(AND|OR|WITH)$/.test(token)) {
      throw new Error(`Malformed license expression: ${expression}`);
    }
    let allowed =
      ALLOWED_LICENSES.includes(token) &&
      (token !== FONT_LICENSE || FONT_PACKAGE.test(packageName));
    if (tokens[position] === 'WITH') {
      const exception = tokens[position + 1] ?? '';
      position += 2;
      allowed = allowed && ALLOWED_EXCEPTIONS.includes(exception);
    }
    return allowed;
  }

  function and(): boolean {
    let value = identifier();
    while (tokens[position] === 'AND') {
      position += 1;
      value = identifier() && value;
    }
    return value;
  }

  function or(): boolean {
    let value = and();
    while (tokens[position] === 'OR') {
      position += 1;
      value = and() || value;
    }
    return value;
  }

  const result = or();
  if (position !== tokens.length) throw new Error(`Malformed license expression: ${expression}`);
  return result;
}

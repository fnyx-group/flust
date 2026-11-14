import { CUSTOM_TEXT_MAX_LENGTH, parseCustomText } from '@/domain/custom-text';
import { err, ok } from '@/domain/result';

describe('parseCustomText', () => {
  it('trims the text', () => {
    expect(parseCustomText('  For my kids \n')).toEqual(ok('For my kids'));
  });

  it.each(['', '   ', '\n\t'])('refuses empty text: %j', (raw) => {
    expect(parseCustomText(raw)).toEqual(err('empty'));
  });

  it('accepts text up to the limit and refuses longer text', () => {
    expect(parseCustomText('a'.repeat(CUSTOM_TEXT_MAX_LENGTH)).ok).toBe(true);
    expect(parseCustomText('a'.repeat(CUSTOM_TEXT_MAX_LENGTH + 1))).toEqual(err('too-long'));
  });

  it('counts an emoji as one character', () => {
    const emoji = '\u{1F331}';
    expect(parseCustomText(emoji.repeat(CUSTOM_TEXT_MAX_LENGTH)).ok).toBe(true);
    expect(parseCustomText(emoji.repeat(CUSTOM_TEXT_MAX_LENGTH + 1))).toEqual(err('too-long'));
  });

  it('does not count surrounding spaces', () => {
    expect(parseCustomText(` ${'a'.repeat(CUSTOM_TEXT_MAX_LENGTH)} `).ok).toBe(true);
  });
});

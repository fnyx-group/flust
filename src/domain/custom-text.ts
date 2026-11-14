import { err, ok, type Result } from '@/domain/result';

declare const customTextBrand: unique symbol;

// Text the user wrote, on one line, trimmed and within the length limit.
export type CustomText = string & { readonly [customTextBrand]: true };

export type CustomTextError = 'empty' | 'too-long';

export const CUSTOM_TEXT_MAX_LENGTH = 120;

// Pasted line breaks and runs of spaces become one space, since the text is shown as a short
// label. The length is counted in code points, so a simple emoji counts once; flags and joined
// emoji count as several.
export function parseCustomText(raw: string): Result<CustomText, CustomTextError> {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (text.length === 0) return err('empty');
  if ([...text].length > CUSTOM_TEXT_MAX_LENGTH) return err('too-long');
  return ok(text as CustomText);
}

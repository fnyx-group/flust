import { err, ok, type Result } from '@/domain/result';

declare const customTextBrand: unique symbol;

// Text the user wrote, trimmed and within the length limit.
export type CustomText = string & { readonly [customTextBrand]: true };

export type CustomTextError = 'empty' | 'too-long';

export const CUSTOM_TEXT_MAX_LENGTH = 120;

// Counted in code points so that an emoji counts as one character, as the user sees it.
export function parseCustomText(raw: string): Result<CustomText, CustomTextError> {
  const text = raw.trim();
  if (text.length === 0) return err('empty');
  if ([...text].length > CUSTOM_TEXT_MAX_LENGTH) return err('too-long');
  return ok(text as CustomText);
}

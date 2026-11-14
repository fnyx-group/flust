import { localDayNumber, type UtcOffsetAt } from '@/domain/local-time';
import type { Timestamp } from '@/domain/time';

export type QuoteAuthor = 'epictetus' | 'seneca' | 'marcus-aurelius';

type QuoteDefinition = { readonly id: string; readonly author: QuoteAuthor | null };

// The order is the order of the days: authors alternate, and the first day gets an opener.
// The text of each quote is in the locales. docs/product/quotes.md lists their sources.
export const QUOTES = [
  { id: 'nothing-great', author: 'epictetus' },
  { id: 'urge-wave', author: null },
  { id: 'claim-yourself', author: 'seneca' },
  { id: 'lapse-moment', author: null },
  { id: 'headland', author: 'marcus-aurelius' },
  { id: 'instead', author: null },
  { id: 'wait-impression', author: 'epictetus' },
  { id: 'next-hour', author: null },
  { id: 'imagination', author: 'seneca' },
  { id: 'notice-urge', author: null },
  { id: 'whole-life', author: 'marcus-aurelius' },
  { id: 'clean-day', author: null },
  { id: 'best-of-yourself', author: 'epictetus' },
  { id: 'rest-not-escape', author: null },
  { id: 'favorable-wind', author: 'seneca' },
  { id: 'freedom-quietly', author: null },
  { id: 'color-of-thoughts', author: 'marcus-aurelius' },
  { id: 'attention', author: null },
  { id: 'habit', author: 'epictetus' },
  { id: 'progress', author: null },
  { id: 'change-mind', author: 'seneca' },
  { id: 'ten-minutes', author: null },
  { id: 'dig-within', author: 'marcus-aurelius' },
  { id: 'why-started', author: null },
  { id: 'judgments', author: 'epictetus' },
  { id: 'putting-off', author: 'seneca' },
  { id: 'be-one', author: 'marcus-aurelius' },
  { id: 'up-to-us', author: 'epictetus' },
  { id: 'reason', author: 'seneca' },
  { id: 'retreat', author: 'marcus-aurelius' },
] as const satisfies readonly QuoteDefinition[];

export type Quote = (typeof QUOTES)[number];

// Days are counted from the journey's first local day, so every journey opens on the first quote
// and goes through all of them before one repeats. A clock set before the start still lands on a
// quote, thanks to the positive remainder.
export function quoteOfTheDay(start: Timestamp, now: Timestamp, offsetAt: UtcOffsetAt): Quote {
  const day = localDayNumber(now, offsetAt) - localDayNumber(start, offsetAt);
  const index = ((day % QUOTES.length) + QUOTES.length) % QUOTES.length;
  // The index is always within bounds; the fallback only satisfies noUncheckedIndexedAccess.
  return QUOTES[index] ?? QUOTES[0];
}

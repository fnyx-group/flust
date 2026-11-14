import { localDayNumber, type UtcOffsetAt } from '@/domain/local-time';
import type { Timestamp } from '@/domain/time';

export type QuoteAuthor = 'epictetus' | 'seneca' | 'marcus-aurelius';

type QuoteDefinition = { readonly id: string; readonly author: QuoteAuthor | null };

// The order is the order of the days. There are 18 ancient lines for 12 original ones, so they
// follow the pattern ancient, original, ancient, ancient, original: two originals are never next
// to each other, and never more than two ancient lines. The ancient authors take turns, and the
// first day gets an opener.
// The text of each quote is in the locales. docs/product/quotes.md lists their sources.
export const QUOTES = [
  { id: 'nothing-great', author: 'epictetus' },
  { id: 'urge-wave', author: null },
  { id: 'claim-yourself', author: 'seneca' },
  { id: 'headland', author: 'marcus-aurelius' },
  { id: 'lapse-moment', author: null },
  { id: 'wait-impression', author: 'epictetus' },
  { id: 'instead', author: null },
  { id: 'imagination', author: 'seneca' },
  { id: 'whole-life', author: 'marcus-aurelius' },
  { id: 'next-hour', author: null },
  { id: 'best-of-yourself', author: 'epictetus' },
  { id: 'notice-urge', author: null },
  { id: 'favorable-wind', author: 'seneca' },
  { id: 'color-of-thoughts', author: 'marcus-aurelius' },
  { id: 'clean-day', author: null },
  { id: 'habit', author: 'epictetus' },
  { id: 'rest-not-escape', author: null },
  { id: 'change-mind', author: 'seneca' },
  { id: 'dig-within', author: 'marcus-aurelius' },
  { id: 'freedom-quietly', author: null },
  { id: 'judgments', author: 'epictetus' },
  { id: 'attention', author: null },
  { id: 'putting-off', author: 'seneca' },
  { id: 'be-one', author: 'marcus-aurelius' },
  { id: 'progress', author: null },
  { id: 'up-to-us', author: 'epictetus' },
  { id: 'ten-minutes', author: null },
  { id: 'reason', author: 'seneca' },
  { id: 'retreat', author: 'marcus-aurelius' },
  { id: 'why-started', author: null },
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

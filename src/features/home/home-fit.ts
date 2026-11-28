import { largeTextScale, spacing } from '@/ui/theme';

// The smallest the streak ring gets before the home screen hides the quote.
export const HOME_RING_MIN = 200;

// Measured with onLayout, in points. The quote is measured even while it is hidden.
export type HomeHeights = {
  readonly rankLine: number;
  // The quote block: its text, two lines at most, and the author's line when there is one.
  readonly quote: number;
  // The low mood card and the support line, 0 when neither shows.
  readonly notices: number;
};

export type HomeFitInput = {
  // The height between the header and the check-in line above the pinned buttons.
  readonly available: number;
  readonly fontScale: number;
  // The ring for the screen width (streakRingSize).
  readonly ringMax: number;
  readonly heights: HomeHeights;
};

// When even the smallest ring does not fit, the content scrolls above the pinned buttons.
export type HomeFit = {
  readonly ring: number;
  readonly quote: boolean;
};

// Spacing of the home screen, which HomeScreen uses too, so the sum below matches the layout.
export const homeSpacing = {
  // The least space above and below the block of ring, rank line and quote, which is centered
  // in whatever height is left.
  middlePadding: spacing.s,
  // Between the ring, the rank line and the quote.
  middleGap: spacing.xl,
  // Above the pinned block, and between its parts.
  actionsPadding: spacing.m,
  actionsGap: spacing.s,
} as const;

// The ring shrinks to HOME_RING_MIN, then the quote is hidden. Above largeTextScale the quote
// stays, since losing text would hurt more than scrolling.
export function fitHome({ available, fontScale, ringMax, heights }: HomeFitInput): HomeFit {
  const ringMin = Math.min(HOME_RING_MIN, ringMax);
  const steps = fontScale > largeTextScale ? [true] : [true, false];
  for (const quote of steps) {
    const room = Math.floor(available - heightWithoutRing(quote, heights));
    if (room >= ringMin) return { ring: Math.min(ringMax, room), quote };
  }
  return { ring: ringMin, quote: steps.at(-1) ?? true };
}

// The block pinned under the scrolling content: the check-in line, the urge button, the lapse link
// and, after a lapse, the undo line, with the padding above them and the gaps between them.
export type PinnedHeights = {
  readonly checkIn: number;
  readonly urge: number;
  readonly lapse: number;
  // 0 while the undo line is hidden, which also takes away its gap.
  readonly undo: number;
};

// The most of the window height the pinned block may take. Beyond it, at large text or display
// sizes, only the urge button stays pinned, and the rest scrolls under the notices.
export const PINNED_MAX_SHARE = 0.35;

export function pinnedBlockHeight({ checkIn, urge, lapse, undo }: PinnedHeights): number {
  const parts = undo > 0 ? [checkIn, urge, lapse, undo] : [checkIn, urge, lapse];
  const total = parts.reduce((sum, part) => sum + part, 0);
  return homeSpacing.actionsPadding + total + (parts.length - 1) * homeSpacing.actionsGap;
}

export function pinsAllActions(heights: PinnedHeights, windowHeight: number): boolean {
  return pinnedBlockHeight(heights) <= windowHeight * PINNED_MAX_SHARE;
}

function heightWithoutRing(quote: boolean, heights: HomeHeights): number {
  return (
    2 * homeSpacing.middlePadding +
    homeSpacing.middleGap +
    heights.rankLine +
    (quote ? homeSpacing.middleGap + heights.quote : 0) +
    heights.notices
  );
}

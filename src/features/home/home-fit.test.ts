import {
  fitHome,
  HOME_RING_MIN,
  homeSpacing,
  PINNED_MAX_SHARE,
  pinsAllActions,
  type HomeHeights,
  type PinnedHeights,
} from '@/features/home/home-fit';
import { largeTextScale, sizes } from '@/ui/theme';

// As measured on an Android emulator at font scale 1.0, with a two line quote without an author.
const HEIGHTS: HomeHeights = { rankLine: 44, quote: 48, notices: 0 };
// The same quote with its author's line: a 4 point gap and an 18 point line.
const WITH_AUTHOR: HomeHeights = { ...HEIGHTS, quote: 48 + 4 + 18 };

// The height a phone takes outside the space for the ring, the rank line and the quote: the top
// padding, the 44 point header row, the check-in line and the pinned buttons with their padding,
// and the tab bar with the system bar below it.
const ANDROID_CHROME = 60 + 44 + 198 + 73;
// The iPhone SE: a 20 point status bar under the 60 point top padding, and a 49 point tab bar.
const IPHONE_SE_CHROME = 60 + 44 + 198 + 49;

// Without the ring: the padding, the rank line, and the quote with its gap.
const WITHOUT_QUOTE = 2 * homeSpacing.middlePadding + homeSpacing.middleGap + HEIGHTS.rankLine;
const WITH_QUOTE = WITHOUT_QUOTE + homeSpacing.middleGap + HEIGHTS.quote;

// The result and whether the content it lays out is taller than the space, so that it scrolls.
function fit(available: number, fontScale = 1, heights: HomeHeights = HEIGHTS) {
  const { ring, quote } = fitHome({ available, fontScale, ringMax: sizes.streakRing, heights });
  const content =
    2 * homeSpacing.middlePadding +
    ring +
    homeSpacing.middleGap +
    heights.rankLine +
    (quote ? homeSpacing.middleGap + heights.quote : 0) +
    heights.notices;
  return { ring, quote, scrolls: content > available };
}

describe('fitHome', () => {
  it('shows the full ring and the quote when they fit', () => {
    expect(fit(WITH_QUOTE + sizes.streakRing + 50)).toEqual({
      ring: sizes.streakRing,
      quote: true,
      scrolls: false,
    });
  });

  it('shrinks the ring first, down to the smallest size', () => {
    expect(fit(WITH_QUOTE + 240)).toEqual({ ring: 240, quote: true, scrolls: false });
    expect(fit(WITH_QUOTE + HOME_RING_MIN)).toEqual({
      ring: HOME_RING_MIN,
      quote: true,
      scrolls: false,
    });
  });

  it('then hides the quote, and the ring takes the height it frees', () => {
    expect(fit(WITH_QUOTE + HOME_RING_MIN - 1)).toEqual({
      ring: HOME_RING_MIN - 1 + homeSpacing.middleGap + HEIGHTS.quote,
      quote: false,
      scrolls: false,
    });
  });

  it('scrolls only when even the ring at its smallest does not fit', () => {
    expect(fit(WITHOUT_QUOTE + HOME_RING_MIN - 1)).toEqual({
      ring: HOME_RING_MIN,
      quote: false,
      scrolls: true,
    });
  });

  it('keeps the quote with large text and scrolls instead', () => {
    const large = largeTextScale + 0.1;
    expect(fit(WITH_QUOTE + HOME_RING_MIN - 1, large)).toEqual({
      ring: HOME_RING_MIN,
      quote: true,
      scrolls: true,
    });
    expect(fit(WITH_QUOTE + 240, large)).toEqual({ ring: 240, quote: true, scrolls: false });
  });

  it('makes room for the low mood card and the support line', () => {
    const withNotices = { ...HEIGHTS, notices: 60 };
    expect(fit(WITH_QUOTE + sizes.streakRing, 1, withNotices)).toEqual({
      ring: sizes.streakRing - 60,
      quote: true,
      scrolls: false,
    });
  });

  it('does not scroll on a 667 point tall phone, with or without an author', () => {
    for (const heights of [HEIGHTS, WITH_AUTHOR]) {
      expect(fit(667 - IPHONE_SE_CHROME, 1, heights)).toMatchObject({
        quote: false,
        scrolls: false,
      });
      expect(fit(667 - ANDROID_CHROME, 1, heights)).toMatchObject({
        quote: false,
        scrolls: false,
      });
    }
  });

  it('keeps a quote without an author from 731 points tall', () => {
    expect(fit(731 - ANDROID_CHROME)).toMatchObject({ ring: HOME_RING_MIN, quote: true });
    expect(fit(730 - ANDROID_CHROME)).toMatchObject({ quote: false, scrolls: false });
  });

  it('keeps a quote with its author from 753 points tall, and hides both together', () => {
    expect(fit(731 - ANDROID_CHROME, 1, WITH_AUTHOR)).toMatchObject({ quote: false });
    expect(fit(753 - ANDROID_CHROME, 1, WITH_AUTHOR)).toMatchObject({
      ring: HOME_RING_MIN,
      quote: true,
    });
    expect(fit(752 - ANDROID_CHROME, 1, WITH_AUTHOR)).toMatchObject({
      quote: false,
      scrolls: false,
    });
  });

  it('may scroll on a 640 point tall phone', () => {
    expect(fit(640 - ANDROID_CHROME)).toEqual({
      ring: HOME_RING_MIN,
      quote: false,
      scrolls: true,
    });
  });

  it('never grows the ring past the size for the screen width', () => {
    expect(fitHome({ available: 2000, fontScale: 1, ringMax: 240, heights: HEIGHTS }).ring).toBe(
      240,
    );
    expect(
      fitHome({ available: WITH_QUOTE + 170, fontScale: 1, ringMax: 170, heights: HEIGHTS }),
    ).toEqual({ ring: 170, quote: true });
  });
});

// As measured on an Android emulator: the check-in line, the urge button and the lapse link.
const PINNED: PinnedHeights = { checkIn: 44, urge: 58, lapse: 48 };
const PINNED_BLOCK =
  homeSpacing.actionsPadding +
  PINNED.checkIn +
  PINNED.urge +
  PINNED.lapse +
  2 * homeSpacing.actionsGap;
// The same block at font scale 2.0, where each line takes twice the height.
const PINNED_LARGE: PinnedHeights = { checkIn: 88, urge: 100, lapse: 96 };

describe('pinsAllActions', () => {
  it('keeps the check-in line and the lapse link pinned at the default size, from 640 points tall', () => {
    expect(pinsAllActions(PINNED, 640)).toBe(true);
    expect(pinsAllActions(PINNED, 667)).toBe(true);
  });

  it('pins only the urge button when the block would take more than its share of the window', () => {
    expect(pinsAllActions(PINNED_LARGE, 711)).toBe(false);
    expect(pinsAllActions(PINNED_LARGE, 1200)).toBe(true);
  });

  it('allows the block exactly its share', () => {
    expect(pinsAllActions(PINNED, PINNED_BLOCK / PINNED_MAX_SHARE)).toBe(true);
    expect(pinsAllActions(PINNED, PINNED_BLOCK / PINNED_MAX_SHARE - 1)).toBe(false);
  });
});

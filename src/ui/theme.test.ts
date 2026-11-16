import { colors, todayBarOpacity, wheelNearOpacity } from '@/ui/theme';

type Color = keyof typeof colors;
type Rgb = readonly [number, number, number];

function rgb(color: Color): Rgb {
  const hex = colors[color];
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  return [r, g, b];
}

// A color drawn at an opacity over a background, as the screen shows it.
function blend(foreground: Color, background: Color, alpha: number): Rgb {
  const [fr, fg, fb] = rgb(foreground);
  const [br, bg, bb] = rgb(background);
  return [
    alpha * fr + (1 - alpha) * br,
    alpha * fg + (1 - alpha) * bg,
    alpha * fb + (1 - alpha) * bb,
  ];
}

// WCAG 2.2 relative luminance and contrast ratio.
function luminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (lr ?? 0) + 0.7152 * (lg ?? 0) + 0.0722 * (lb ?? 0);
}

function ratio(foreground: Rgb, background: Rgb): number {
  const [light = 0, dark = 0] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (light + 0.05) / (dark + 0.05);
}

function contrast(foreground: Color, background: Color, alpha = 1): number {
  return ratio(blend(foreground, background, alpha), rgb(background));
}

const TEXT = 4.5;
const SHAPE = 3;

describe('theme contrast', () => {
  it('checks the ratio against known values', () => {
    expect(contrast('text', 'background')).toBeCloseTo(18.82, 2);
    expect(contrast('locked', 'background')).toBeCloseTo(2.82, 2);
    expect(contrast('textSecondary', 'background', 0.5)).toBeCloseTo(3.24, 2);
  });

  it.each<[Color, Color]>([
    ['text', 'background'],
    ['text', 'surface'],
    ['text', 'separator'],
    ['textSecondary', 'background'],
    ['textSecondary', 'surface'],
    ['textSecondary', 'separator'],
    ['muted', 'background'],
    ['muted', 'surface'],
    ['accent', 'background'],
    ['onAccent', 'accent'],
  ])('reads %s text on %s at 4.5:1 or more', (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(TEXT);
  });

  // The wheel sheet has the background color; its rows fade out away from the selected one.
  it('reads the wheel rows next to the selected one at 4.5:1 or more', () => {
    expect(contrast('textSecondary', 'background', wheelNearOpacity)).toBeGreaterThanOrEqual(TEXT);
  });

  it.each<[Color, Color]>([
    ['accent', 'background'],
    ['accent', 'surface'],
    // The ring of an unchecked radio button, which shows that the row can be chosen.
    ['muted', 'surface'],
  ])('shows %s shapes on %s at 3:1 or more', (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(SHAPE);
  });

  it("shows today's bar in the week strip at 3:1 or more", () => {
    expect(contrast('accent', 'background', todayBarOpacity)).toBeGreaterThanOrEqual(SHAPE);
  });
});

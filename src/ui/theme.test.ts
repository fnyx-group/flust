import { colors, disabledOpacity, pressedOpacity } from '@/ui/theme';

type Color = keyof typeof colors;

// WCAG 2.2 relative luminance and contrast ratio.
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: Color, background: Color): number {
  const [light, dark] = [luminance(colors[foreground]), luminance(colors[background])].sort(
    (a, b) => b - a,
  );
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

const TEXT = 4.5;
const SHAPE = 3;

describe('theme contrast', () => {
  it('checks the ratio against known values', () => {
    expect(contrast('text', 'background')).toBeCloseTo(18.82, 2);
    expect(contrast('locked', 'background')).toBeCloseTo(2.82, 2);
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

  it.each<[Color, Color]>([
    ['accent', 'background'],
    ['accent', 'surface'],
  ])('shows %s shapes on %s at 3:1 or more', (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(SHAPE);
  });

  it('keeps locked, which is too dark for text, for shapes only', () => {
    expect(contrast('locked', 'background')).toBeLessThan(TEXT);
    expect(contrast('muted', 'surface')).toBeGreaterThan(contrast('locked', 'surface'));
  });
});

describe('control states', () => {
  // A disabled button used the pressed opacity, so it looked available.
  it('makes a disabled control clearly fainter than a pressed one', () => {
    expect(disabledOpacity).toBeLessThan(pressedOpacity - 0.25);
  });
});

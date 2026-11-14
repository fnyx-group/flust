import { isOneOf } from '@/domain/guards';

describe('isOneOf', () => {
  const isColor = isOneOf(['red', 'blue'] as const);

  it('accepts the listed values only', () => {
    expect(isColor('red')).toBe(true);
    expect(isColor('blue')).toBe(true);
    expect(isColor('green')).toBe(false);
    expect(isColor(null)).toBe(false);
    expect(isColor(['red'])).toBe(false);
  });
});

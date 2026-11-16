import { controlOpacity } from '@/ui/control-opacity';
import { disabledOpacity, pressedOpacity } from '@/ui/theme';

describe('controlOpacity', () => {
  it('keeps an available control opaque until it is pressed', () => {
    expect(controlOpacity(false, false)).toEqual({ opacity: 1 });
    expect(controlOpacity(true, false)).toEqual({ opacity: pressedOpacity });
  });

  // A disabled button used the pressed opacity, so it looked available.
  it('makes a disabled control fainter than a pressed one', () => {
    expect(controlOpacity(false, true).opacity).toBeLessThan(controlOpacity(true, false).opacity);
  });

  it('keeps a disabled control faint when it is touched', () => {
    expect(controlOpacity(true, true)).toEqual({ opacity: disabledOpacity });
  });
});

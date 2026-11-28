import { StyleSheet } from 'react-native';

import { measuring } from '@/features/home/measuring';

describe('measuring', () => {
  it('keeps what is being measured unseen, untouchable and away from screen readers', () => {
    const props = measuring(true);
    expect(StyleSheet.flatten(props.style)).toEqual({ opacity: 0, pointerEvents: 'none' });
    expect(props.accessibilityElementsHidden).toBe(true);
    expect(props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('changes nothing once measured', () => {
    expect(measuring(false)).toEqual({});
  });
});

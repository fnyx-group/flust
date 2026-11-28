import { StyleSheet, type ViewProps } from 'react-native';

type Measuring = Pick<ViewProps, 'accessibilityElementsHidden' | 'importantForAccessibility'> & {
  style?: ViewProps['style'];
};

// Laid out once to be measured before it shows. Until then it is unseen, and neither a tap nor a
// screen reader reaches it: the urge button could otherwise be pressed, or read, in a layout that
// is about to change.
export function measuring(active: boolean): Measuring {
  if (!active) return {};
  return {
    style: styles.unseen,
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants',
  };
}

const styles = StyleSheet.create({
  unseen: {
    opacity: 0,
    pointerEvents: 'none',
  },
});

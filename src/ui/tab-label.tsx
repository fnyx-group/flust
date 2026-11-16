import { StyleSheet, Text, type ColorValue } from 'react-native';

import { maxFontScale, typography } from '@/ui/theme';

// The tab bar keeps its height, so labels grow only so far; on iOS, a long press shows the label
// large, through the large content viewer.
export function TabLabel({ color, children }: { color: ColorValue; children: string }) {
  return (
    <Text
      maxFontSizeMultiplier={maxFontScale.tabLabel}
      style={[typography.tabLabel, styles.label, { color }]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    textAlign: 'center',
  },
});

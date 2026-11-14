import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/ui/theme';

type ProgressBarProps = {
  current: number;
  total: number;
  accessibilityLabel: string;
};

export function ProgressBar({ current, total, accessibilityLabel }: ProgressBarProps) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: total, now: current }}
      style={styles.bar}
    >
      {Array.from({ length: total }, (_, index) => (
        <View key={index} style={[styles.segment, index < current && styles.done]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.s,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.separator,
  },
  done: {
    backgroundColor: colors.accent,
  },
});

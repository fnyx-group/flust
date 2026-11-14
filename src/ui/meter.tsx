import { StyleSheet, View } from 'react-native';

import { colors, sizes } from '@/ui/theme';

type MeterProps = {
  // Between 0 and 1.
  fraction: number;
  // Without a label the meter is decorative, for a parent that already announces the progress.
  accessibilityLabel?: string;
};

const PERCENT = 100;

export function Meter({ fraction, accessibilityLabel }: MeterProps) {
  const percent = Math.round(Math.min(1, Math.max(0, fraction)) * PERCENT);
  const accessible = accessibilityLabel !== undefined;
  return (
    <View
      accessible={accessible}
      importantForAccessibility={accessible ? 'yes' : 'no-hide-descendants'}
      accessibilityRole={accessible ? 'progressbar' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={accessible ? { min: 0, max: PERCENT, now: percent } : undefined}
      style={styles.track}
    >
      <View style={[styles.fill, { width: `${percent}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: sizes.meterHeight,
    borderRadius: sizes.meterHeight / 2,
    backgroundColor: colors.separator,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: sizes.meterHeight / 2,
    backgroundColor: colors.accent,
  },
});

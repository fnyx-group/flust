import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { RadioOption } from '@/ui/radio-group';
import { colors, fonts, radii, sizes, spacing, typography } from '@/ui/theme';

type SegmentedControlProps<K extends string> = {
  accessibilityLabel: string;
  options: readonly RadioOption<K>[];
  selected: K;
  onSelect: (key: K) => void;
};

// Only one segment can be chosen, so screen readers announce the segments as radio buttons.
export function SegmentedControl<K extends string>({
  accessibilityLabel,
  options,
  selected,
  onSelect,
}: SegmentedControlProps<K>) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={styles.control}
    >
      {options.map((option) => {
        const checked = option.key === selected;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
            onPress={() => onSelect(option.key)}
            style={[styles.segment, checked && styles.checked]}
          >
            <Text style={[styles.label, checked && styles.checkedLabel]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  control: {
    flexDirection: 'row',
    padding: spacing.xs,
    gap: spacing.xs,
    borderRadius: radii.segmentedControl,
    backgroundColor: colors.surface,
  },
  segment: {
    flex: 1,
    minHeight: sizes.touchTarget + 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.s,
    borderRadius: radii.segment,
  },
  checked: {
    backgroundColor: colors.separator,
  },
  label: {
    ...typography.row,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  checkedLabel: {
    fontFamily: fonts.bold,
    color: colors.text,
  },
});

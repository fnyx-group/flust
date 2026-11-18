import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { RadioOption } from '@/ui/radio-group';
import { colors, fonts, radii, sizes, spacing, typography } from '@/ui/theme';
import { useLargeText } from '@/ui/use-large-text';

type SegmentedControlProps<K extends string> = {
  accessibilityLabel: string;
  options: readonly RadioOption<K>[];
  // Null until a first choice, when no answer must be suggested.
  selected: K | null;
  onSelect: (key: K) => void;
  // The fill of the chosen segment, under text in the on-accent color.
  color?: string;
};

// Only one segment can be chosen, so screen readers announce the segments as radio buttons. With
// large text, four labels side by side would break mid-word, so the segments stack.
export function SegmentedControl<K extends string>({
  accessibilityLabel,
  options,
  selected,
  onSelect,
  color = colors.accent,
}: SegmentedControlProps<K>) {
  const stacked = useLargeText();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.control, stacked && styles.stacked]}
    >
      {options.map((option) => {
        const checked = option.key === selected;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
            onPress={() => onSelect(option.key)}
            style={[
              styles.segment,
              stacked && styles.stackedSegment,
              checked && { backgroundColor: color },
            ]}
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
  stacked: {
    flexDirection: 'column',
  },
  segment: {
    flex: 1,
    minHeight: sizes.touchTarget + 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.s,
    borderRadius: radii.segment,
  },
  stackedSegment: {
    flex: 0,
    paddingVertical: spacing.s,
  },
  label: {
    ...typography.row,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  checkedLabel: {
    fontFamily: fonts.extraBold,
    color: colors.onAccent,
  },
});

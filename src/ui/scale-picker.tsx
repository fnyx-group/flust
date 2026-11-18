import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, pressedOpacity, radii, sizes, spacing, typography } from '@/ui/theme';

export type ScaleOption<V extends number> = {
  value: V;
  // What a screen reader says for this value, such as "1 out of 5, not good".
  spokenLabel: string;
};

type ScalePickerProps<V extends number> = {
  accessibilityLabel: string;
  options: readonly ScaleOption<V>[];
  selected: V | null;
  onSelect: (value: V) => void;
  lowLabel: string;
  highLabel: string;
};

// A row of numbered tiles with the meaning of both ends under it. One value can be chosen, so
// screen readers announce the tiles as radio buttons; the end labels are part of the first and
// last tiles' labels and hidden on their own.
export function ScalePicker<V extends number>({
  accessibilityLabel,
  options,
  selected,
  onSelect,
  lowLabel,
  highLabel,
}: ScalePickerProps<V>) {
  return (
    <View style={styles.container}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={accessibilityLabel}
        style={styles.row}
      >
        {options.map((option) => {
          const checked = option.value === selected;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.spokenLabel}
              accessibilityState={{ checked }}
              onPress={() => onSelect(option.value)}
              style={({ pressed }) => [
                styles.option,
                checked && styles.checked,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.value, checked && styles.checkedValue]}>{option.value}</Text>
            </Pressable>
          );
        })}
      </View>
      <View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={styles.ends}
      >
        <Text style={styles.end}>{lowLabel}</Text>
        <Text style={[styles.end, styles.highEnd]}>{highLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.s,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.s,
  },
  option: {
    flex: 1,
    minHeight: sizes.scaleOption,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.segmentedControl,
    borderWidth: 1.5,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  checked: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  pressed: {
    opacity: pressedOpacity,
  },
  value: {
    ...typography.stepperValue,
    color: colors.text,
  },
  checkedValue: {
    fontFamily: fonts.bold,
    color: colors.onAccent,
  },
  ends: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.l,
    paddingHorizontal: spacing.xs,
  },
  end: {
    ...typography.body,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  highEnd: {
    textAlign: 'right',
  },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, sizes, typography } from '@/ui/theme';

export type RadioOption<K extends string> = { key: K; label: string };

type RadioGroupProps<K extends string> = {
  accessibilityLabel: string;
  options: readonly RadioOption<K>[];
  selected: K | null;
  onSelect: (key: K) => void;
};

export function RadioGroup<K extends string>({
  accessibilityLabel,
  options,
  selected,
  onSelect,
}: RadioGroupProps<K>) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={styles.card}
    >
      {options.map((option, index) => {
        const checked = option.key === selected;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
            onPress={() => onSelect(option.key)}
            style={({ pressed }) => [
              styles.row,
              index > 0 && styles.separated,
              pressed && styles.pressed,
            ]}
          >
            <RadioMark checked={checked} />
            <Text style={[styles.label, checked && styles.checkedLabel]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RadioMark({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.mark, checked && styles.checkedMark]}>
      {checked && <View style={styles.dot} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  row: {
    minHeight: sizes.touchTarget + 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  separated: {
    borderTopWidth: 1,
    borderTopColor: colors.separator,
  },
  pressed: {
    opacity: 0.8,
  },
  label: {
    ...typography.bodyLarge,
    flex: 1,
    color: colors.text,
  },
  checkedLabel: {
    fontFamily: fonts.bold,
  },
  mark: {
    width: sizes.radio,
    height: sizes.radio,
    borderRadius: sizes.radio / 2,
    borderWidth: 2,
    borderColor: colors.locked,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedMark: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dot: {
    width: sizes.radio / 3,
    height: sizes.radio / 3,
    borderRadius: sizes.radio / 6,
    backgroundColor: colors.onAccent,
  },
});

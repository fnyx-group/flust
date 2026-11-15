import { Pressable, StyleSheet, Text } from 'react-native';

import { ScrollView } from '@/ui/scroll-view';
import { colors, pressedOpacity, radii, sizes, spacing, typography } from '@/ui/theme';

type ActionChip<K extends string> = { key: K; label: string };

type ActionChipsProps<K extends string> = {
  chips: readonly ActionChip<K>[];
  onPress: (key: K) => void;
};

// Chips that each do something rather than select an option, so screen readers announce them as
// buttons. They scroll sideways on one line, and run to the edges of the screen.
export function ActionChips<K extends string>({ chips, onPress }: ActionChipsProps<K>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      style={styles.scroll}
      contentContainerStyle={styles.list}
    >
      {chips.map((chip) => (
        <Pressable
          key={chip.key}
          accessibilityRole="button"
          onPress={() => onPress(chip.key)}
          style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
        >
          <Text style={styles.label}>{chip.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    marginHorizontal: -spacing.screen,
  },
  list: {
    gap: spacing.m,
    paddingHorizontal: spacing.screen,
  },
  chip: {
    minHeight: sizes.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.chipHorizontal,
    paddingVertical: spacing.chipVertical,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  pressed: {
    opacity: pressedOpacity,
  },
  label: {
    ...typography.bodyLarge,
    color: colors.text,
  },
});

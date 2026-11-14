import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, sizes, typography } from '@/ui/theme';

type ChipItem<K extends string> = { key: K; label: string; selected: boolean };

type ChipListProps<K extends string> = {
  items: readonly ChipItem<K>[];
  onToggle: (key: K) => void;
};

// Chips select several options at once, so screen readers announce them as checkboxes.
export function ChipList<K extends string>({ items, onToggle }: ChipListProps<K>) {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.selected }}
          onPress={() => onToggle(item.key)}
          style={({ pressed }) => [
            styles.chip,
            item.selected && styles.selected,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.label, item.selected && styles.selectedLabel]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chip: {
    minHeight: sizes.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  selected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pressed: {
    opacity: 0.8,
  },
  label: {
    ...typography.bodyLarge,
    color: colors.text,
  },
  selectedLabel: {
    fontFamily: fonts.bold,
    color: colors.onAccent,
  },
});

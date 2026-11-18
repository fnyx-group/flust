import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CheckIcon } from '@/ui/icons/check-icon';
import {
  colors,
  fonts,
  pressedOpacity,
  radii,
  sizes,
  spacing,
  tint,
  tintAlpha,
  typography,
} from '@/ui/theme';

type ChipItem<K extends string> = { key: K; label: string; selected: boolean };

type ChipListProps<K extends string> = {
  items: readonly ChipItem<K>[];
  onToggle: (key: K) => void;
  // The color of a selected chip: its outline, its check and a faint fill.
  color?: string;
};

// Chips select several options at once, so screen readers announce them as checkboxes. A check
// marks the selected ones, so the choice never relies on color alone.
export function ChipList<K extends string>({
  items,
  onToggle,
  color = colors.accent,
}: ChipListProps<K>) {
  const selectedStyle = { borderColor: color, backgroundColor: tint(color, tintAlpha.chip) };
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
            item.selected && selectedStyle,
            pressed && styles.pressed,
          ]}
        >
          {item.selected && <CheckIcon color={color} size={18} />}
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
    gap: spacing.m,
  },
  chip: {
    minHeight: sizes.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingHorizontal: spacing.chipHorizontal,
    paddingVertical: spacing.chipVertical,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: pressedOpacity,
  },
  label: {
    ...typography.bodyLarge,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  selectedLabel: {
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
});

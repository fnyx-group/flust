import { Pressable, StyleSheet, Text } from 'react-native';

import { ChevronDownIcon } from '@/ui/icons/chevron-down-icon';
import { colors, pressedOpacity, radii, sizes, spacing, typography } from '@/ui/theme';

type SelectRowProps = {
  prefix: string;
  value: string;
  accessibilityHint: string;
  onPress: () => void;
};

export function SelectRow({ prefix, value, accessibilityHint, onPress }: SelectRowProps) {
  const label = [prefix, value].join(' ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.prefix}>{prefix}</Text>
      <Text style={styles.value}>{value}</Text>
      <ChevronDownIcon color={colors.textSecondary} size={sizes.icon} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: sizes.row,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.l,
    paddingHorizontal: spacing.rowHorizontal,
    paddingVertical: spacing.rowVertical,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: pressedOpacity,
  },
  prefix: {
    ...typography.bodyLarge,
    minWidth: 40,
    color: colors.textSecondary,
  },
  value: {
    ...typography.selectValue,
    flex: 1,
    color: colors.text,
  },
});

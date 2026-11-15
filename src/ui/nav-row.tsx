import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ForwardIcon } from '@/ui/icons/forward-icon';
import { PlusIcon } from '@/ui/icons/plus-icon';
import { colors, pressedOpacity, sizes, spacing, typography } from '@/ui/theme';

type NavRowProps = {
  // Read by screen readers. Defaults to the label and the value.
  accessibilityLabel?: string;
  accessibilityHint?: string;
  onPress: () => void;
} & ({ label: string; value?: string; children?: never } | { children: ReactNode; label?: never });

// A row of a RowGroup that opens another screen or a sheet: its label, or any content, an
// optional value, and a chevron.
export function NavRow({
  accessibilityLabel,
  accessibilityHint,
  onPress,
  ...content
}: NavRowProps) {
  const spoken =
    accessibilityLabel ??
    (content.label === undefined ? undefined : [content.label, content.value].join(' '));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.content}>
        {content.label === undefined ? (
          content.children
        ) : (
          <Text style={styles.label}>{content.label}</Text>
        )}
      </View>
      {content.label !== undefined && content.value !== undefined && (
        <Text style={styles.value}>{content.value}</Text>
      )}
      <ForwardIcon color={colors.textSecondary} size={20} />
    </Pressable>
  );
}

// The last row of a list, which adds an item to it.
export function AddRow({
  label,
  onPress,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <PlusIcon color={colors.textSecondary} />
      <Text style={styles.add}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: sizes.touchTarget + 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  pressed: {
    opacity: pressedOpacity,
  },
  content: {
    flex: 1,
  },
  label: {
    ...typography.row,
    color: colors.text,
  },
  value: {
    ...typography.bodyLarge,
    flexShrink: 1,
    textAlign: 'right',
    color: colors.textSecondary,
  },
  add: {
    ...typography.bodyLarge,
    flex: 1,
    color: colors.textSecondary,
  },
});

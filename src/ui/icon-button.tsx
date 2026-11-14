import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { colors, radii, sizes } from '@/ui/theme';

type IconButtonProps = {
  accessibilityLabel: string;
  onPress: () => void;
  children: ReactNode;
};

export function IconButton({ accessibilityLabel, onPress, children }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: radii.iconButton,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
});

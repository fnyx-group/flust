import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { colors, disabledOpacity, pressedOpacity, radii, sizes } from '@/ui/theme';

type IconButtonProps = {
  accessibilityLabel: string;
  onPress: () => void;
  children: ReactNode;
  disabled?: boolean;
};

// The button is drawn at 40 points; the hit slop brings the touch target to 48.
export function IconButton({
  accessibilityLabel,
  onPress,
  children,
  disabled = false,
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
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
    opacity: pressedOpacity,
  },
  disabled: {
    opacity: disabledOpacity,
  },
});

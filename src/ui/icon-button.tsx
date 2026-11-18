import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { controlOpacity } from '@/ui/control-opacity';
import { colors, radii, sizes } from '@/ui/theme';

type IconButtonProps = {
  accessibilityLabel: string;
  onPress: () => void;
  children: ReactNode;
  disabled?: boolean;
  // Accent for the main action of a screen, such as a new note.
  variant?: 'surface' | 'accent';
};

// The button is drawn at 40 points; the hit slop brings the touch target to 48.
export function IconButton({
  accessibilityLabel,
  onPress,
  children,
  disabled = false,
  variant = 'surface',
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
        variant === 'accent' && styles.accent,
        controlOpacity(pressed, disabled),
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
  accent: {
    backgroundColor: colors.accent,
  },
});

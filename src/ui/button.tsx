import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, sizes, typography } from '@/ui/theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
};

export function Button({ label, onPress, variant = 'primary', disabled = false }: ButtonProps) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        isPrimary ? styles.primary : styles.secondary,
        (pressed || disabled) && styles.pressed,
      ]}
    >
      <Text style={isPrimary ? styles.primaryLabel : styles.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    height: sizes.primaryButtonHeight,
    borderRadius: radii.primaryButton,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    height: sizes.secondaryButtonHeight,
    borderRadius: radii.secondaryButton,
    borderWidth: 1,
    borderColor: colors.separator,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  primaryLabel: {
    ...typography.primaryButton,
    color: colors.onAccent,
  },
  secondaryLabel: {
    ...typography.secondaryButton,
    color: colors.text,
  },
});

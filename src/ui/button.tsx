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
      <Text style={[isPrimary ? styles.primaryLabel : styles.secondaryLabel, styles.label]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // A minimum height lets the label grow with large text instead of being clipped.
  primary: {
    minHeight: sizes.primaryButtonHeight,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radii.primaryButton,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    minHeight: sizes.secondaryButtonHeight,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.secondaryButton,
    borderWidth: 1,
    borderColor: colors.separator,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  label: {
    textAlign: 'center',
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

import { Pressable, StyleSheet, Text } from 'react-native';

import { controlOpacity } from '@/ui/control-opacity';
import { colors, radii, sizes, spacing, typography } from '@/ui/theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  // Danger and destructive are for actions that delete something: filled, or plain text.
  variant?: 'primary' | 'secondary' | 'plain' | 'danger' | 'destructive';
  disabled?: boolean;
  accessibilityHint?: string;
  // A button that leaves the app is a link.
  accessibilityRole?: 'button' | 'link';
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  accessibilityHint,
  accessibilityRole = 'button',
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [CONTAINERS[variant], controlOpacity(pressed, disabled)]}
    >
      <Text style={[LABELS[variant], styles.label]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // A minimum height lets the label grow with large text instead of being clipped.
  filled: {
    minHeight: sizes.primaryButtonHeight,
    paddingVertical: spacing.m,
    paddingHorizontal: 20,
    borderRadius: radii.primaryButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.accent,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  secondary: {
    minHeight: sizes.secondaryButtonHeight,
    paddingVertical: 10,
    paddingHorizontal: spacing.l,
    borderRadius: radii.secondaryButton,
    borderWidth: 1.5,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plain: {
    minHeight: sizes.secondaryButtonHeight,
    paddingVertical: 10,
    paddingHorizontal: spacing.l,
    alignItems: 'center',
    justifyContent: 'center',
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
  plainLabel: {
    ...typography.secondaryButton,
    color: colors.textSecondary,
  },
  destructiveLabel: {
    ...typography.secondaryButton,
    color: colors.danger,
  },
});

const CONTAINERS = {
  primary: [styles.filled, styles.primary],
  secondary: styles.secondary,
  plain: styles.plain,
  danger: [styles.filled, styles.danger],
  destructive: styles.plain,
};
const LABELS = {
  primary: styles.primaryLabel,
  secondary: styles.secondaryLabel,
  plain: styles.plainLabel,
  danger: styles.primaryLabel,
  destructive: styles.destructiveLabel,
};

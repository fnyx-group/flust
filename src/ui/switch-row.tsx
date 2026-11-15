import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, pressedOpacity, radii, sizes, spacing, typography } from '@/ui/theme';

type SwitchRowProps = {
  title: string;
  subtitle?: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  // Content under the subtitle, such as the time of a reminder.
  children?: ReactNode;
};

const KNOB = sizes.switchHeight - 8;

// A row of a RowGroup with a title, a subtitle and a switch. The whole row is the switch, so it
// is one element for screen readers and one large target.
export function SwitchRow({
  title,
  subtitle,
  value,
  disabled = false,
  onChange,
  children,
}: SwitchRowProps) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={title}
        accessibilityHint={subtitle}
        accessibilityState={{ checked: value, disabled }}
        disabled={disabled}
        onPress={() => onChange(!value)}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <View style={styles.text}>
          <Text style={[styles.title, disabled && styles.disabled]}>{title}</Text>
          {subtitle !== undefined && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        <View style={[styles.track, value && styles.trackOn, disabled && styles.trackDisabled]}>
          <View style={[styles.knob, value && styles.knobOn]} />
        </View>
      </Pressable>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.rowHorizontal,
    paddingVertical: spacing.rowVertical,
    gap: spacing.m,
  },
  main: {
    minHeight: sizes.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.l,
  },
  pressed: {
    opacity: pressedOpacity,
  },
  text: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.row,
    color: colors.text,
  },
  disabled: {
    color: colors.textSecondary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  track: {
    width: sizes.switchWidth,
    height: sizes.switchHeight,
    borderRadius: radii.pill,
    padding: 4,
    backgroundColor: colors.separator,
  },
  trackOn: {
    backgroundColor: colors.accent,
  },
  trackDisabled: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: radii.pill,
    backgroundColor: colors.textSecondary,
  },
  knobOn: {
    marginLeft: sizes.switchWidth - KNOB - 8,
    backgroundColor: colors.text,
  },
});

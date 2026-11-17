import type { ComponentType, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconTile } from '@/ui/icon-tile';
import type { IconProps } from '@/ui/icons/line-icon';
import { colors, pressedOpacity, radii, sizes, spacing, typography } from '@/ui/theme';

type SwitchRowProps = {
  title: string;
  subtitle?: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  // A tinted icon before the title; its color also fills the switch when on.
  icon?: { icon: ComponentType<IconProps>; color: string };
  // Content between the text and the switch, such as the time of a reminder.
  accessory?: ReactNode;
  // Content under the row, such as a notice.
  children?: ReactNode;
};

const KNOB = sizes.switchHeight - 8;

// A row of a RowGroup with a title, a subtitle and a switch. The text and the switch both toggle
// it, and screen readers get one switch element: the drawn switch is hidden from them. An
// accessory between them, such as a time chip, stays its own button.
export function SwitchRow({
  title,
  subtitle,
  value,
  disabled = false,
  onChange,
  icon,
  accessory,
  children,
}: SwitchRowProps) {
  const onColor = icon?.color ?? colors.accent;
  return (
    <View style={styles.row}>
      <View style={styles.main}>
        {icon !== undefined && <IconTile icon={icon.icon} color={icon.color} />}
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={title}
          accessibilityHint={subtitle}
          accessibilityState={{ checked: value, disabled }}
          disabled={disabled}
          onPress={() => onChange(!value)}
          style={({ pressed }) => [styles.text, pressed && styles.pressed]}
        >
          <Text style={[styles.title, disabled && styles.disabled]}>{title}</Text>
          {subtitle !== undefined && <Text style={styles.subtitle}>{subtitle}</Text>}
        </Pressable>
        {accessory}
        <Pressable
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          disabled={disabled}
          hitSlop={spacing.s}
          onPress={() => onChange(!value)}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <View
            style={[
              styles.track,
              value && { backgroundColor: onColor },
              disabled && styles.trackDisabled,
            ]}
          >
            <View style={[styles.knob, value && styles.knobOn]} />
          </View>
        </Pressable>
      </View>
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
    minHeight: sizes.touchTarget,
    justifyContent: 'center',
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
    backgroundColor: colors.locked,
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
    backgroundColor: colors.text,
  },
  knobOn: {
    marginLeft: sizes.switchWidth - KNOB - 8,
  },
});

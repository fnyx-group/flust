import { useState, type ComponentType, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { accessoryBeside } from '@/ui/accessory-fit';
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
  // Content between the text and the switch, such as the time of a reminder. It goes under the
  // text when the text would have no room left for its longest word (accessoryBeside).
  accessory?: ReactNode;
  // Content under the row, such as a notice.
  children?: ReactNode;
};

const KNOB = sizes.switchHeight - 8;

// A row of a RowGroup with a title, a subtitle and a switch. The text and the switch both toggle
// it, and screen readers get one switch element: the drawn switch is hidden from them. An
// accessory between them, such as a time chip, stays its own button, and moves under the text
// when large text leaves the text no room.
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
  const hasAccessory = accessory !== undefined && accessory !== null && accessory !== false;
  const [row, setRow] = useState<number | null>(null);
  const [accessoryWidth, setAccessoryWidth] = useState<number | null>(null);
  const [wordWidths, setWordWidths] = useState<Record<string, number>>({});
  const words = [
    ...wordsOf(title).map((word) => ({ key: `title:${word}`, word, style: styles.title })),
    ...wordsOf(subtitle ?? '').map((word) => ({
      key: `subtitle:${word}`,
      word,
      style: styles.subtitle,
    })),
  ];
  const widths = words.map(({ key }) => wordWidths[key]);
  const beside =
    !hasAccessory ||
    row === null ||
    accessoryWidth === null ||
    widths.some((width) => width === undefined) ||
    accessoryBeside({
      row,
      others: icon === undefined ? [sizes.switchWidth] : [sizes.iconTile, sizes.switchWidth],
      accessory: accessoryWidth,
      gap: spacing.l,
      widestWord: Math.ceil(Math.max(...widths.map((width) => width ?? 0))),
    });

  const measureWord = (key: string) => (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setWordWidths((previous) =>
      previous[key] === width ? previous : { ...previous, [key]: width },
    );
  };
  const accessoryView = hasAccessory && (
    <View
      onLayout={(event) => setAccessoryWidth(event.nativeEvent.layout.width)}
      style={!beside && [styles.below, icon !== undefined && styles.belowIcon]}
    >
      {accessory}
    </View>
  );

  return (
    <View style={styles.row}>
      {hasAccessory && (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.offstage}
        >
          {words.map(({ key, word, style }) => (
            <Text key={key} onLayout={measureWord(key)} style={style}>
              {word}
            </Text>
          ))}
        </View>
      )}
      <View style={styles.main} onLayout={(event) => setRow(event.nativeEvent.layout.width)}>
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
        {beside && accessoryView}
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
      {!beside && accessoryView}
      {children}
    </View>
  );
}

function wordsOf(text: string): string[] {
  return [...new Set(text.split(/\s+/).filter((word) => word.length > 0))];
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
  below: {
    alignSelf: 'flex-start',
  },
  // Under the text, past the icon.
  belowIcon: {
    marginLeft: sizes.iconTile + spacing.l,
  },
  // Out of the flow, unseen and unreachable. Each word shrinks to its width on one line, up to the
  // row's.
  offstage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'flex-start',
    opacity: 0,
    pointerEvents: 'none',
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
    backgroundColor: colors.muted,
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

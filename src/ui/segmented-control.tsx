import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import type { RadioOption } from '@/ui/radio-group';
import { segmentColumns } from '@/ui/segment-columns';
import { colors, fonts, radii, sizes, spacing, typography } from '@/ui/theme';

type SegmentedControlProps<K extends string> = {
  accessibilityLabel: string;
  options: readonly RadioOption<K>[];
  // Null until a first choice, when no answer must be suggested.
  selected: K | null;
  onSelect: (key: K) => void;
  // The fill of the chosen segment, under text in the on-accent color.
  color?: string;
};

// Only one segment can be chosen, so screen readers announce the segments as radio buttons. The
// labels are measured on one line, offstage and in the bold of the chosen segment, and the
// segments go on as few rows as keep every label whole (segmentColumns).
export function SegmentedControl<K extends string>({
  accessibilityLabel,
  options,
  selected,
  onSelect,
  color = colors.accent,
}: SegmentedControlProps<K>) {
  const [available, setAvailable] = useState<number | null>(null);
  const [labelWidths, setLabelWidths] = useState<Partial<Record<K, number>>>({});
  const widths = options.map((option) => labelWidths[option.key]);
  const columns =
    available === null || widths.some((width) => width === undefined)
      ? options.length
      : segmentColumns({
          count: options.length,
          available,
          gap: spacing.xs,
          widest: Math.ceil(Math.max(...widths.map((width) => width ?? 0))) + 2 * SEGMENT_PADDING,
        });
  const rows = chunks(options, columns);

  const measureLabel = (key: K) => (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setLabelWidths((previous) =>
      previous[key] === width ? previous : { ...previous, [key]: width },
    );
  };

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={styles.control}
      onLayout={(event) => setAvailable(event.nativeEvent.layout.width - 2 * spacing.xs)}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.offstage}
      >
        {options.map((option) => (
          <Text key={option.key} onLayout={measureLabel(option.key)} style={styles.measuredLabel}>
            {option.label}
          </Text>
        ))}
      </View>
      {rows.map((row) => (
        <View key={row.map((option) => option.key).join()} style={styles.row}>
          {row.map((option) => {
            const checked = option.key === selected;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="radio"
                accessibilityState={{ checked }}
                onPress={() => onSelect(option.key)}
                style={[styles.segment, checked && { backgroundColor: color }]}
              >
                <Text style={[styles.label, checked && styles.checkedLabel]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    rows.push(items.slice(start, start + size));
  }
  return rows;
}

const SEGMENT_PADDING = spacing.s;

const styles = StyleSheet.create({
  control: {
    padding: spacing.xs,
    gap: spacing.xs,
    borderRadius: radii.segmentedControl,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  // Out of the flow, unseen and unreachable. Each label shrinks to its width on one line, up to
  // the control's.
  offstage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'flex-start',
    opacity: 0,
    pointerEvents: 'none',
  },
  segment: {
    flex: 1,
    minHeight: sizes.touchTarget + 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SEGMENT_PADDING,
    paddingVertical: spacing.s,
    borderRadius: radii.segment,
  },
  label: {
    ...typography.row,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  checkedLabel: {
    fontFamily: fonts.extraBold,
    color: colors.onAccent,
  },
  measuredLabel: {
    ...typography.row,
    fontFamily: fonts.extraBold,
  },
});

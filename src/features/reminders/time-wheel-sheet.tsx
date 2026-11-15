import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MinuteOfDay } from '@/domain/reminders';
import { indexesOf, minuteOf, type WheelIndexes } from '@/domain/time-wheel';
import { wheelRowLabels } from '@/features/reminders/labels';
import { useReduceMotion } from '@/features/shared/use-reduce-motion';
import { Button } from '@/ui/button';
import { useOverlaysHidden } from '@/ui/overlays';
import { backdropOpacity, colors, radii, spacing, typography } from '@/ui/theme';
import { Wheel } from '@/ui/wheel';

type TimeWheelSheetProps = {
  title: string;
  minute: MinuteOfDay;
  language: string;
  hour12: boolean;
  labels: {
    readonly hours: string;
    readonly minutes: string;
    readonly period: string;
    readonly save: string;
    readonly cancel: string;
  };
  onSave: (minute: MinuteOfDay) => void;
  onCancel: () => void;
};

const NUMBER_WHEEL_WIDTH = 76;
const PERIOD_WHEEL_WIDTH = 88;

// Mounted while a time is being chosen. The wheels show the nearest five minutes; a time that is
// not on them is kept as it is until a wheel moves. Closes while the app is locked and comes
// back with its state once unlocked.
export function TimeWheelSheet({
  title,
  minute,
  language,
  hour12,
  labels,
  onSave,
  onCancel,
}: TimeWheelSheetProps) {
  const insets = useSafeAreaInsets();
  const hidden = useOverlaysHidden();
  const reduceMotion = useReduceMotion() !== false;
  const [rows] = useState(() => wheelRowLabels(language, hour12));
  const [indexes, setIndexes] = useState(() => indexesOf(minute, hour12));
  const [moved, setMoved] = useState(false);

  function select(change: Partial<WheelIndexes>) {
    setIndexes({ ...indexes, ...change });
    setMoved(true);
  }

  return (
    <Modal visible={!hidden} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.container}>
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          accessibilityElementsHidden
          onPress={onCancel}
          style={styles.backdrop}
        />
        <View
          accessibilityViewIsModal
          onAccessibilityEscape={onCancel}
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.screen }]}
        >
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <View style={styles.wheels}>
            <Wheel
              rows={rows.hours}
              selectedIndex={indexes.hour}
              onChange={(hour) => select({ hour })}
              label={labels.hours}
              reduceMotion={reduceMotion}
              width={NUMBER_WHEEL_WIDTH}
            />
            <Wheel
              rows={rows.minutes}
              selectedIndex={indexes.minute}
              onChange={(index) => select({ minute: index })}
              label={labels.minutes}
              reduceMotion={reduceMotion}
              width={NUMBER_WHEEL_WIDTH}
            />
            {hour12 && (
              <Wheel
                rows={rows.periods}
                selectedIndex={indexes.period}
                onChange={(period) => select({ period })}
                label={labels.period}
                reduceMotion={reduceMotion}
                width={PERIOD_WHEEL_WIDTH}
              />
            )}
          </View>
          <View style={styles.actions}>
            <Button
              label={labels.save}
              onPress={() => onSave(moved ? minuteOf(indexes, hour12) : minute)}
            />
            <Button variant="plain" label={labels.cancel} onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
    opacity: backdropOpacity,
  },
  sheet: {
    gap: spacing.l,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.screen,
    borderTopLeftRadius: radii.cardLarge,
    borderTopRightRadius: radii.cardLarge,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderColor: colors.separator,
  },
  title: {
    ...typography.rankName,
    color: colors.text,
  },
  wheels: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.m,
  },
  actions: {
    gap: spacing.xs,
    paddingTop: spacing.s,
  },
});

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/ui/button';
import { useOverlaysHidden } from '@/ui/overlays';
import { Stepper } from '@/ui/stepper';
import { backdropOpacity, colors, radii, spacing, typography } from '@/ui/theme';

type StepperLabels = {
  label: string;
  value: string;
  decrementLabel: string;
  incrementLabel: string;
  onDecrement: () => void;
  onIncrement: () => void;
};

type TimeSheetProps = {
  visible: boolean;
  title: string;
  hour: StepperLabels;
  minute: StepperLabels;
  saveLabel: string;
  cancelLabel: string;
  onSave: () => void;
  onCancel: () => void;
};

// Built like ConfirmSheet. A time of day wraps around midnight, so both steppers always move.
export function TimeSheet({
  visible,
  title,
  hour,
  minute,
  saveLabel,
  cancelLabel,
  onSave,
  onCancel,
}: TimeSheetProps) {
  const insets = useSafeAreaInsets();
  const hidden = useOverlaysHidden();
  return (
    <Modal visible={visible && !hidden} transparent animationType="fade" onRequestClose={onCancel}>
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
          <View style={styles.steppers}>
            <Stepper {...hour} canDecrement canIncrement />
            <Stepper {...minute} canDecrement canIncrement />
          </View>
          <View style={styles.actions}>
            <Button label={saveLabel} onPress={onSave} />
            <Button variant="plain" label={cancelLabel} onPress={onCancel} />
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
  steppers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.m,
  },
  actions: {
    gap: spacing.xs,
    paddingTop: spacing.s,
  },
});

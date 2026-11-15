import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/ui/button';
import { backdropOpacity, colors, radii, spacing, typography } from '@/ui/theme';

type ConfirmSheetProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// Built like OptionSheet: a fade, a backdrop that cancels, and the escape gesture. Cancelling is
// the safe choice, so it is the primary button and comes first; confirming is a plain button.
// Screen readers skip the backdrop: the cancel button and the escape gesture already cancel, and
// a second "Cancel" would read as another choice.
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
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
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Button label={cancelLabel} onPress={onCancel} />
            <Button variant="plain" label={confirmLabel} onPress={onConfirm} />
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
  message: {
    ...typography.paragraph,
    color: colors.textSecondary,
  },
  actions: {
    gap: spacing.xs,
    paddingTop: spacing.s,
  },
});

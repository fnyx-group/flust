import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/ui/button';
import { useOverlaysHidden } from '@/ui/overlays';
import { ScrollView } from '@/ui/scroll-view';
import { backdropOpacity, colors, radii, spacing, typography } from '@/ui/theme';

type ConfirmSheetProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  // The confirmation deletes something, so it reads in the danger color.
  destructive?: boolean;
};

// Built like OptionSheet: a fade, a backdrop that cancels, and the escape gesture. Cancelling is
// the safe choice, so it is the primary button and comes first; confirming is a plain button.
// Screen readers skip the backdrop: the cancel button and the escape gesture already cancel, and
// a second "Cancel" would read as another choice. A long text, such as Google Play's disclosure at
// a large font size, scrolls between the title and the buttons, which always stay on screen.
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmSheetProps) {
  const insets = useSafeAreaInsets();
  const hidden = useOverlaysHidden();
  return (
    <Modal visible={visible && !hidden} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.container, { paddingTop: insets.top + spacing.screen }]}>
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
          <ScrollView style={styles.text} contentContainerStyle={styles.textContent}>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Text style={styles.message}>{message}</Text>
          </ScrollView>
          <View style={styles.actions}>
            <Button label={cancelLabel} onPress={onCancel} />
            <Button
              variant={destructive ? 'destructive' : 'plain'}
              label={confirmLabel}
              onPress={onConfirm}
            />
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
    flexShrink: 1,
    gap: spacing.l,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.screen,
    borderTopLeftRadius: radii.cardLarge,
    borderTopRightRadius: radii.cardLarge,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderColor: colors.separator,
  },
  text: {
    flexGrow: 0,
    flexShrink: 1,
  },
  textContent: {
    gap: spacing.l,
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

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/ui/button';
import { RadioGroup, type RadioOption } from '@/ui/radio-group';
import { ScrollView } from '@/ui/scroll-view';
import { colors, radii, spacing, typography } from '@/ui/theme';

type OptionSheetProps<K extends string> = {
  visible: boolean;
  title: string;
  closeLabel: string;
  options: readonly RadioOption<K>[];
  selected: K | null;
  onSelect: (key: K) => void;
  onClose: () => void;
};

// A fade keeps the motion small for people who reduce motion; the sheet itself does not move.
// VoiceOver cannot reach the backdrop behind a modal view, so the sheet has its own close button
// and answers the escape gesture. The options scroll on small screens and with large text.
export function OptionSheet<K extends string>({
  visible,
  title,
  closeLabel,
  options,
  selected,
  onSelect,
  onClose,
}: OptionSheetProps<K>) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          onPress={onClose}
          style={styles.backdrop}
        />
        <View
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.screen }]}
        >
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <ScrollView style={styles.options}>
            <RadioGroup
              accessibilityLabel={title}
              options={options}
              selected={selected}
              onSelect={(key) => {
                onSelect(key);
                onClose();
              }}
            />
          </ScrollView>
          <Button variant="secondary" label={closeLabel} onPress={onClose} />
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
    opacity: 0.85,
  },
  sheet: {
    maxHeight: '85%',
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
  options: {
    flexGrow: 0,
    flexShrink: 1,
  },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { HelpAction, HelpEntry } from '@/domain/help-resources';
import { actionHint, entryDetail, entryName, spokenAction } from '@/features/help/labels';
import { colors, pressedOpacity, sizes, spacing, typography } from '@/ui/theme';

type HelpRowsProps = {
  entry: HelpEntry;
  onOpen: (entry: HelpEntry, action: HelpAction) => void;
};

// One entry of a help card: its first action is the row with the name, the detail and the
// number; a second action, such as a text message, gets a short row of its own under it.
export function HelpRows({ entry, onOpen }: HelpRowsProps) {
  const { t } = useTranslation();
  const [first, ...others] = entry.actions;
  if (first === undefined) return null;
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={spokenAction(t, entry, first)}
        accessibilityHint={actionHint(t, first)}
        onPress={() => onOpen(entry, first)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.texts}>
          <Text style={styles.name}>{entryName(t, entry)}</Text>
          <Text style={styles.detail}>{entryDetail(t, entry)}</Text>
        </View>
        <Text style={styles.number}>{entry.display}</Text>
      </Pressable>
      {others.map((action) => (
        <Pressable
          key={action}
          accessibilityRole="button"
          accessibilityLabel={spokenAction(t, entry, action)}
          accessibilityHint={actionHint(t, action)}
          onPress={() => onOpen(entry, action)}
          style={({ pressed }) => [styles.row, styles.other, pressed && styles.pressed]}
        >
          <Text style={styles.otherLabel}>{t('help.textRow', { number: entry.display })}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: sizes.row,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingHorizontal: spacing.rowHorizontal,
    paddingVertical: spacing.rowVertical,
  },
  other: {
    minHeight: sizes.touchTarget,
    paddingTop: 0,
  },
  pressed: {
    opacity: pressedOpacity,
  },
  texts: {
    flex: 1,
    gap: spacing.xxs,
  },
  name: {
    ...typography.row,
    color: colors.text,
  },
  detail: {
    ...typography.paragraphSmall,
    color: colors.textSecondary,
  },
  number: {
    ...typography.countdown,
    color: colors.text,
  },
  otherLabel: {
    ...typography.row,
    color: colors.textSecondary,
  },
});

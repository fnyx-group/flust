import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { HelpAction, HelpEntry } from '@/domain/help-resources';
import {
  actionHint,
  entryDetail,
  entryName,
  spokenAction,
  textRowLabel,
  unbrokenNumber,
} from '@/features/help/labels';
import { MessageIcon } from '@/ui/icons/message-icon';
import { PhoneIcon } from '@/ui/icons/phone-icon';
import { colors, pressedOpacity, sizes, spacing, tint, tintAlpha, typography } from '@/ui/theme';
import { useLargeText } from '@/ui/use-large-text';

type HelpRowsProps = {
  entry: HelpEntry;
  onOpen: (entry: HelpEntry, action: HelpAction) => void;
  failure: string | null;
};

// One entry of a help card: its first action is the row with the name, the detail and the
// number; a second action, such as a text message, gets a short row of its own under it. A
// failure to open shows right under the entry that was tapped, where the eye already is.
export function HelpRows({ entry, onOpen, failure }: HelpRowsProps) {
  const { t } = useTranslation();
  // With large text, a long number such as "0800 32 123" leaves too little room beside it for
  // the name and the detail, so the number goes under them.
  const stacked = useLargeText();
  const [first, ...others] = entry.actions;
  if (first === undefined) return null;
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={spokenAction(t, entry, first)}
        accessibilityHint={actionHint(t, first)}
        onPress={() => onOpen(entry, first)}
        style={({ pressed }) => [
          styles.row,
          stacked ? styles.stacked : styles.inline,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.number, !stacked && styles.numberColumn]}>
          {unbrokenNumber(entry.display)}
        </Text>
        <View style={[styles.texts, !stacked && styles.fill]}>
          <Text style={styles.name}>{entryName(t, entry)}</Text>
          <Text style={styles.detail}>{entryDetail(t, entry)}</Text>
        </View>
        <ActionIcon action={first} />
      </Pressable>
      {others.map((action) => (
        <Pressable
          key={action}
          accessibilityRole="button"
          accessibilityLabel={spokenAction(t, entry, action)}
          accessibilityHint={actionHint(t, action)}
          onPress={() => onOpen(entry, action)}
          style={({ pressed }) => [
            styles.row,
            styles.inline,
            styles.other,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.otherLabel}>{textRowLabel(t, entry)}</Text>
        </Pressable>
      ))}
      {failure !== null && <HelpFailure message={failure} />}
    </View>
  );
}

// A call or a message, as the round button at the end of the row. The row is the button: this
// only shows what it does.
function ActionIcon({ action }: { action: HelpAction }) {
  const Icon = action === 'call' ? PhoneIcon : MessageIcon;
  return (
    <View style={styles.action}>
      <Icon color={colors.teal} size={22} />
    </View>
  );
}

// The number or the address to use by hand, under the row that could not open.
function HelpFailure({ message }: { message: string }) {
  return (
    <Text accessibilityRole="alert" style={styles.failure}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: sizes.row,
    gap: spacing.m,
    paddingHorizontal: spacing.rowHorizontal,
    paddingVertical: spacing.rowVertical,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stacked: {
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  other: {
    minHeight: sizes.touchTarget,
    paddingTop: 0,
  },
  pressed: {
    opacity: pressedOpacity,
  },
  texts: {
    gap: spacing.xxs,
  },
  // Flexing only in a row: in a stacked column with no height, it could squash the text.
  fill: {
    flex: 1,
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
    ...typography.helpNumber,
    color: colors.text,
  },
  // The numbers of a card line up, and a short one leaves the same room as a long one.
  numberColumn: {
    minWidth: 64,
  },
  action: {
    width: sizes.callButton,
    height: sizes.callButton,
    borderRadius: sizes.callButton / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tint(colors.teal, tintAlpha.chip),
  },
  otherLabel: {
    ...typography.row,
    color: colors.textSecondary,
  },
  failure: {
    ...typography.paragraphSmall,
    color: colors.text,
    paddingHorizontal: spacing.rowHorizontal,
    paddingBottom: spacing.rowVertical,
  },
});

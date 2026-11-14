import { StyleSheet, TextInput, View } from 'react-native';

import { PlusIcon } from '@/ui/icons/plus-icon';
import { RadioMark } from '@/ui/radio-group';
import { colors, radii, sizes, typography } from '@/ui/theme';

type TextEntryRowProps = {
  label: string;
  value: string;
  maxLength: number;
  onChangeText: (text: string) => void;
  accessibilityHint?: string;
  // Set when the row is one choice among radio options: it then shows whether it is chosen.
  selected?: boolean;
  // Drawn inside another card, such as the last row of a radio group, instead of as its own.
  embedded?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
};

export function TextEntryRow({
  label,
  value,
  maxLength,
  onChangeText,
  accessibilityHint,
  selected,
  embedded = false,
  onFocus,
  onBlur,
}: TextEntryRowProps) {
  return (
    <View style={[styles.row, !embedded && styles.card]}>
      {selected === undefined ? (
        <PlusIcon color={colors.textSecondary} />
      ) : (
        <RadioMark checked={selected} />
      )}
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={selected === undefined ? undefined : { selected }}
        placeholder={label}
        placeholderTextColor={colors.textSecondary}
        value={value}
        maxLength={maxLength}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        multiline
        submitBehavior="blurAndSubmit"
        returnKeyType="done"
        selectionColor={colors.accent}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: sizes.touchTarget + 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  card: {
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  input: {
    ...typography.bodyLarge,
    flex: 1,
    minHeight: sizes.touchTarget,
    paddingVertical: 10,
    color: colors.text,
  },
});

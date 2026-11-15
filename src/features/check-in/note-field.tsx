import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CHECK_IN_NOTE_MAX_LENGTH } from '@/domain/check-in';
import { colors, radii, spacing, typography } from '@/ui/theme';

type NoteFieldProps = { value: string; onChangeText: (text: string) => void };

// maxLength counts UTF-16 units, never more than code points, so the domain limit always holds.
export function NoteField({ value, onChangeText }: NoteFieldProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.field}>
      <Text importantForAccessibility="no" accessibilityElementsHidden style={styles.label}>
        {t('checkIn.note')} <Text style={styles.optional}>{t('checkIn.optional')}</Text>
      </Text>
      <TextInput
        accessibilityLabel={t('checkIn.noteSpoken')}
        placeholder={t('checkIn.notePlaceholder')}
        placeholderTextColor={colors.textSecondary}
        value={value}
        maxLength={CHECK_IN_NOTE_MAX_LENGTH}
        onChangeText={onChangeText}
        multiline
        textAlignVertical="top"
        selectionColor={colors.accent}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.m,
  },
  label: {
    ...typography.sectionLabel,
    color: colors.text,
  },
  optional: {
    fontFamily: typography.bodyLarge.fontFamily,
    color: colors.textSecondary,
  },
  input: {
    ...typography.paragraph,
    minHeight: 112,
    padding: spacing.card,
    paddingTop: spacing.l,
    borderRadius: radii.cardLarge,
    backgroundColor: colors.surface,
    color: colors.text,
  },
});

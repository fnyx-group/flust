import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PROMPT_IDS, type PromptId } from '@/features/journal/labels';
import { ActionChips } from '@/ui/action-chips';
import { colors, spacing, typography } from '@/ui/theme';

// Each chip inserts its starter line, given in the app language, into the text.
export function NotePrompts({ onInsert }: { onInsert: (starter: string) => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('journal.note.prompts')}</Text>
      <ActionChips
        chips={PROMPT_IDS.map((id) => ({ key: id, label: t(`journal.note.promptLabels.${id}`) }))}
        onPress={(id: PromptId) => onInsert(t(`journal.note.promptStarters.${id}`))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.m,
  },
  label: {
    ...typography.sectionLabel,
    color: colors.gold,
  },
});

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/ui/button';
import { colors, spacing, typography } from '@/ui/theme';

export function EmptyJournal({ onWrite }: { onWrite: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('journal.empty.title')}</Text>
      <View style={styles.action}>
        <Button variant="secondary" label={t('journal.empty.action')} onPress={onWrite} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.s,
  },
  title: {
    ...typography.row,
    textAlign: 'center',
    color: colors.text,
  },
  action: {
    paddingTop: spacing.l,
  },
});

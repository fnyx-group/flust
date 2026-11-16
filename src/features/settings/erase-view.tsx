import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BackHeader } from '@/ui/back-header';
import { Button } from '@/ui/button';
import { ConfirmSheet } from '@/ui/confirm-sheet';
import { Screen } from '@/ui/screen';
import { ScrollView } from '@/ui/scroll-view';
import { colors, spacing, typography } from '@/ui/theme';

// Erasing cannot be undone, so it takes two steps: this screen says what goes, then a sheet asks
// once more, with cancelling as the main choice. No red: the tone stays calm. Shown from the
// settings, and from safe mode, where storage cannot be opened.
export function EraseView({ onBack, onErase }: { onBack: () => void; onErase: () => void }) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

  return (
    <Screen bottomInset>
      <BackHeader backLabel={t('erase.back')} title={t('erase.title')} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.paragraph}>{t('erase.what')}</Text>
        <Text style={styles.paragraph}>{t('erase.noRecovery')}</Text>
        <Text style={styles.paragraph}>{t('erase.after')}</Text>
      </ScrollView>
      <View style={styles.footer}>
        <Text style={styles.hint}>{t('erase.lapseHint')}</Text>
        <Button
          variant="secondary"
          label={t('erase.continue')}
          onPress={() => setConfirming(true)}
        />
      </View>
      <ConfirmSheet
        visible={confirming}
        title={t('erase.confirm.title')}
        message={t('erase.confirm.message')}
        cancelLabel={t('erase.confirm.cancel')}
        confirmLabel={t('erase.confirm.erase')}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onErase();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.l,
    paddingBottom: spacing.xl,
  },
  paragraph: {
    ...typography.paragraph,
    color: colors.textSecondary,
  },
  footer: {
    gap: spacing.l,
    paddingTop: spacing.m,
  },
  hint: {
    ...typography.paragraphSmall,
    color: colors.text,
  },
});

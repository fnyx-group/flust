import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BackHeader } from '@/ui/back-header';
import { Button } from '@/ui/button';
import { ConfirmSheet } from '@/ui/confirm-sheet';
import { IconTile } from '@/ui/icon-tile';
import { TrashIcon } from '@/ui/icons/trash-icon';
import { WaveIcon } from '@/ui/icons/wave-icon';
import { Screen } from '@/ui/screen';
import { ScrollView } from '@/ui/scroll-view';
import { colors, radii, spacing, tint, tintAlpha, typography } from '@/ui/theme';

// Erasing cannot be undone, so it takes two steps: this screen says what goes, then a sheet asks
// once more, with cancelling as the main choice. Red marks the loss, and a calm card reminds that
// a lapse never needs it. Shown from the settings, and from safe mode, where storage cannot be
// opened.
export function EraseView({ onBack, onErase }: { onBack: () => void; onErase: () => void }) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

  return (
    <Screen bottomInset>
      <BackHeader backLabel={t('erase.back')} title={t('erase.title')} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.what}>{t('erase.what')}</Text>
        <View style={[styles.card, styles.danger]}>
          <IconTile icon={TrashIcon} color={colors.danger} />
          <Text style={styles.warning}>{t('erase.noRecovery')}</Text>
        </View>
        <Text style={styles.after}>{t('erase.after')}</Text>
        <View style={[styles.card, styles.calm]}>
          <IconTile icon={WaveIcon} color={colors.teal} />
          <Text style={styles.hint}>{t('erase.lapseHint')}</Text>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button variant="danger" label={t('erase.continue')} onPress={() => setConfirming(true)} />
        <Button variant="plain" label={t('erase.cancel')} onPress={onBack} />
      </View>
      <ConfirmSheet
        visible={confirming}
        title={t('erase.confirm.title')}
        message={t('erase.confirm.message')}
        cancelLabel={t('erase.confirm.cancel')}
        confirmLabel={t('erase.confirm.erase')}
        destructive
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
  what: {
    ...typography.paragraph,
    color: colors.text,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.l,
    padding: spacing.card,
    borderRadius: radii.cardLarge,
  },
  danger: {
    borderWidth: 1.5,
    borderColor: tint(colors.danger, tintAlpha.border),
  },
  calm: {
    alignItems: 'flex-start',
    backgroundColor: colors.accentSurface,
  },
  warning: {
    ...typography.paragraph,
    flex: 1,
    fontFamily: typography.quote.fontFamily,
    color: colors.text,
  },
  after: {
    ...typography.paragraph,
    color: colors.textSecondary,
  },
  hint: {
    ...typography.paragraph,
    flex: 1,
    color: colors.text,
  },
  footer: {
    gap: spacing.xs,
    paddingTop: spacing.m,
  },
});

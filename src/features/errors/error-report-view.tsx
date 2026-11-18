import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { shareReport } from '@/features/errors/share-report';
import { useErrorReport } from '@/features/errors/use-error-report';
import { BackHeader } from '@/ui/back-header';
import { Button } from '@/ui/button';
import { ConfirmSheet } from '@/ui/confirm-sheet';
import { PrivateLine } from '@/ui/private-line';
import { Screen } from '@/ui/screen';
import { ScrollView } from '@/ui/scroll-view';
import { colors, radii, spacing, typography } from '@/ui/theme';

// Shows the exact text the share sheet would carry before it opens, so the person can see that
// it holds nothing personal. Opened from About, and from safe mode.
export function ErrorReportView({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { report, clearFailed, clear } = useErrorReport();
  const [shareFailed, setShareFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const hasEntries = report.status === 'ready' && report.count > 0;

  async function share(text: string) {
    setShareFailed(!(await shareReport(text)));
  }

  return (
    <Screen bottomInset>
      <BackHeader
        backLabel={t('errors.report.back')}
        title={t('errors.report.title')}
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.paragraph}>{t('errors.report.intro')}</Text>
        {report.status === 'ready' && report.count === 0 && (
          <Text style={styles.empty}>{t('errors.report.empty')}</Text>
        )}
        {report.status === 'ready' && report.count > 0 && (
          <View style={styles.preview}>
            <Text style={styles.label}>{t('errors.report.preview')}</Text>
            <View style={styles.card}>
              <Text selectable style={styles.report}>
                {report.text}
              </Text>
            </View>
          </View>
        )}
        <PrivateLine text={t('errors.report.nothingSent')} />
        {clearFailed && (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>
            {t('errors.report.clearFailed')}
          </Text>
        )}
      </ScrollView>
      {hasEntries && (
        <View style={styles.footer}>
          {shareFailed && (
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>
              {t('errors.report.shareFailed')}
            </Text>
          )}
          <Button
            label={t('errors.report.share')}
            accessibilityHint={t('errors.report.shareHint')}
            onPress={() => void share(report.text)}
          />
          <Button
            variant="destructive"
            label={t('errors.report.clear')}
            onPress={() => setConfirming(true)}
          />
        </View>
      )}
      <ConfirmSheet
        visible={confirming}
        title={t('errors.report.confirm.title')}
        message={t('errors.report.confirm.message')}
        cancelLabel={t('errors.report.confirm.cancel')}
        confirmLabel={t('errors.report.confirm.clear')}
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          setShareFailed(false);
          void clear();
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
    color: colors.text,
  },
  empty: {
    ...typography.row,
    color: colors.text,
  },
  preview: {
    gap: spacing.s,
  },
  label: {
    ...typography.sectionLabel,
  },
  card: {
    padding: spacing.card,
    borderRadius: radii.cardLarge,
    backgroundColor: colors.surface,
  },
  report: {
    ...typography.paragraphSmall,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    color: colors.text,
  },
  notice: {
    ...typography.paragraphSmall,
    color: colors.text,
  },
  footer: {
    gap: spacing.xs,
    paddingTop: spacing.m,
  },
});

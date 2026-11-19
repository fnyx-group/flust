import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useEnableFilter } from '@/features/filter/use-enable-filter';
import { useFilterStatus } from '@/features/filter/use-filter-status';
import type { StepProps } from '@/features/onboarding/step-props';
import { StepLayout } from '@/features/onboarding/step-layout';
import { Button } from '@/ui/button';
import { SectionLabel } from '@/ui/section-label';
import { colors, radii, spacing, typography } from '@/ui/theme';

type FilterStepProps = Pick<StepProps, 'progress' | 'onBack' | 'onContinue'>;

// Presents the filter with Google Play's disclosure in full, before Android's VPN dialog, and
// lets it wait (docs/decisions/0042-filter-onboarding-and-disclosure.md). Accepting is the
// affirmative action the policy asks for; "Later" moves on with the filter off. The filter lives
// in its own module, apart from the onboarding answers, so it is not part of the draft.
export function FilterStep({ progress, onBack, onContinue }: FilterStepProps) {
  const { t } = useTranslation();
  const { status, refresh } = useFilterStatus();
  const enabling = useEnableFilter(refresh);
  const on = status.available && status.enabled;

  return (
    <StepLayout
      progress={progress}
      title={t('onboarding.filter.title')}
      subtitle={t('onboarding.filter.subtitle')}
      onBack={onBack}
      backDisabled={enabling.busy}
      action={
        on
          ? { label: t('onboarding.continue'), onPress: onContinue }
          : {
              label: t('filter.disclosure.accept'),
              onPress: () => void enabling.accept(false),
              disabled: enabling.busy,
            }
      }
      footer={
        <>
          {enabling.notice !== null && (
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>
              {t(`filter.${enabling.notice}`)}
            </Text>
          )}
          {!on && (
            <Button
              variant="plain"
              label={t('filter.disclosure.later')}
              disabled={enabling.busy}
              onPress={onContinue}
            />
          )}
        </>
      }
    >
      <View style={styles.section}>
        <SectionLabel color={colors.teal}>{t('onboarding.filter.label')}</SectionLabel>
        <View style={styles.card}>
          <Text style={styles.text}>{t('filter.blocks')}</Text>
          <Text style={styles.text}>{t('filter.disclosure.text')}</Text>
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.caption}>
          {on ? t('onboarding.filter.on') : t('onboarding.filter.later')}
        </Text>
      </View>
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.m,
  },
  card: {
    gap: spacing.m,
    padding: spacing.card,
    borderRadius: radii.cardLarge,
    backgroundColor: colors.surface,
  },
  text: {
    ...typography.paragraph,
    color: colors.text,
  },
  caption: {
    ...typography.body,
    color: colors.textSecondary,
  },
  notice: {
    ...typography.body,
    textAlign: 'center',
    color: colors.text,
  },
});

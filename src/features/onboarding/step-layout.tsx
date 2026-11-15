import { useEffect, type ReactNode } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { StepProgress } from '@/domain/onboarding';
import { handleBackPress } from '@/features/onboarding/back-press';

import { Button } from '@/ui/button';
import { IconButton } from '@/ui/icon-button';
import { BackIcon } from '@/ui/icons/back-icon';
import { ProgressBar } from '@/ui/progress-bar';
import { KeyboardScreen } from '@/ui/keyboard-screen';
import { ScreenTitle } from '@/ui/screen-title';
import { colors, spacing, typography } from '@/ui/theme';

type StepLayoutProps = {
  progress: StepProgress;
  title: string;
  subtitle: string;
  children: ReactNode;
  action: { label: string; onPress: () => void; disabled?: boolean };
  onBack: () => void;
  // Set while the answers are being saved, so that going back cannot race the final save.
  backDisabled?: boolean;
  footer?: ReactNode;
};

export function StepLayout({
  progress,
  title,
  subtitle,
  children,
  action,
  onBack,
  backDisabled = false,
  footer,
}: StepLayoutProps) {
  const { t } = useTranslation();

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () =>
      handleBackPress(onBack, backDisabled),
    );
    return () => subscription.remove();
  }, [onBack, backDisabled]);

  return (
    <KeyboardScreen
      contentContainerStyle={styles.content}
      header={
        <View style={styles.header}>
          <IconButton
            accessibilityLabel={t('onboarding.back')}
            disabled={backDisabled}
            onPress={onBack}
          >
            <BackIcon color={colors.text} size={20} />
          </IconButton>
          <ProgressBar
            current={progress.current}
            total={progress.total}
            accessibilityLabel={t('onboarding.progress', progress)}
          />
        </View>
      }
      footer={
        <View style={styles.footer}>
          <Button label={action.label} onPress={action.onPress} disabled={action.disabled} />
          {footer}
        </View>
      }
    >
      <View style={styles.intro}>
        <ScreenTitle>{title}</ScreenTitle>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {children}
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.l,
    marginBottom: spacing.xxl,
  },
  content: {
    gap: 28,
    paddingBottom: spacing.xl,
  },
  intro: {
    gap: spacing.m,
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
  },
  footer: {
    gap: spacing.l,
    paddingTop: spacing.m,
  },
});

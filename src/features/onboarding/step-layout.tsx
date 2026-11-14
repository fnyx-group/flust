import { useEffect, type ReactNode } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { StepProgress } from '@/domain/onboarding';
import { handleBackPress } from '@/features/onboarding/back-press';

import { Button } from '@/ui/button';
import { IconButton } from '@/ui/icon-button';
import { BackIcon } from '@/ui/icons/back-icon';
import { ProgressBar } from '@/ui/progress-bar';
import { Screen } from '@/ui/screen';
import { ScreenTitle } from '@/ui/screen-title';
import { ScrollView } from '@/ui/scroll-view';
import { colors, typography } from '@/ui/theme';

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
    <Screen bottomInset>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.intro}>
            <ScreenTitle>{title}</ScreenTitle>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          {children}
        </ScrollView>
        <View style={styles.footer}>
          <Button label={action.label} onPress={action.onPress} disabled={action.disabled} />
          {footer}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 32,
  },
  content: {
    gap: 28,
    paddingBottom: 24,
  },
  intro: {
    gap: 12,
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
  },
  footer: {
    gap: 16,
    paddingTop: 12,
  },
});

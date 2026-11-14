import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useStorage } from '@/features/storage/storage-context';
import {
  fallbackLanguage,
  isLanguage,
  supportedLanguages,
  type Language,
} from '@/lib/i18n/language';
import { BrandLockup } from '@/ui/brand/brand-lockup';
import { Button } from '@/ui/button';
import { GlobeIcon } from '@/ui/icons/globe-icon';
import { OptionSheet } from '@/ui/option-sheet';
import { Screen } from '@/ui/screen';
import { colors, pressedOpacity, radii, sizes, spacing, typography } from '@/ui/theme';

type WelcomeStepProps = {
  onStart: () => void;
};

export function WelcomeStep({ onStart }: WelcomeStepProps) {
  const { t } = useTranslation();
  return (
    <Screen bottomInset style={styles.screen}>
      <View style={styles.top}>
        <LanguageChoice />
      </View>
      <View style={styles.body}>
        <BrandLockup />
        <Text accessibilityRole="header" style={styles.title}>
          {t('onboarding.welcome.title')}
        </Text>
        <Text style={styles.paragraph}>{t('onboarding.welcome.promise')}</Text>
        <Text style={styles.paragraph}>{t('onboarding.welcome.duration')}</Text>
      </View>
      <View style={styles.footer}>
        <Button label={t('onboarding.welcome.start')} onPress={onStart} />
        <Text style={styles.caption}>{t('onboarding.welcome.footer')}</Text>
      </View>
    </Screen>
  );
}

// The choice is applied at once and saved, so the rest of the onboarding is in that language.
function LanguageChoice() {
  const { t, i18n } = useTranslation();
  const storage = useStorage();
  const [open, setOpen] = useState(false);
  const current: Language = isLanguage(i18n.language) ? i18n.language : fallbackLanguage;
  const currentLabel = t(`languages.${current}`);

  function choose(language: Language) {
    void i18n.changeLanguage(language);
    void storage.settings.saveLanguage(language);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('onboarding.welcome.language', { language: currentLabel })}
        accessibilityHint={t('onboarding.welcome.languageHint')}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.language, pressed && styles.pressed]}
      >
        <GlobeIcon color={colors.textSecondary} size={20} />
        <Text style={styles.languageLabel}>{currentLabel}</Text>
      </Pressable>
      <OptionSheet
        visible={open}
        title={t('onboarding.welcome.languageTitle')}
        closeLabel={t('onboarding.close')}
        options={supportedLanguages.map((language) => ({
          key: language,
          label: t(`languages.${language}`),
        }))}
        selected={current}
        onSelect={choose}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'space-between',
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  language: {
    minHeight: sizes.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingHorizontal: spacing.l,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: pressedOpacity,
  },
  languageLabel: {
    ...typography.row,
    color: colors.text,
  },
  body: {
    gap: spacing.xl,
  },
  title: {
    ...typography.welcomeTitle,
    color: colors.text,
  },
  paragraph: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
  },
  footer: {
    gap: spacing.l,
  },
  caption: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.textSecondary,
  },
});

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useErasedNotice, useStorage } from '@/features/storage/storage-context';
import {
  fallbackLanguage,
  isLanguage,
  supportedLanguages,
  type Language,
} from '@/lib/i18n/language';
import { BrandHeader } from '@/ui/brand/brand-header';
import { Button } from '@/ui/button';
import { ClockIcon } from '@/ui/icons/clock-icon';
import { GlobeIcon } from '@/ui/icons/globe-icon';
import { OptionSheet } from '@/ui/option-sheet';
import { RankEmblem } from '@/ui/rank-emblem';
import { Screen } from '@/ui/screen';
import { colors, pressedOpacity, radii, sizes, spacing, typography } from '@/ui/theme';

type WelcomeStepProps = {
  onStart: () => void;
};

export function WelcomeStep({ onStart }: WelcomeStepProps) {
  const { t } = useTranslation();
  const erasedNotice = useErasedNotice();

  // Announced once this screen has mounted, so the focus moving to it does not cut it off.
  useEffect(() => {
    if (erasedNotice.take()) {
      AccessibilityInfo.announceForAccessibilityWithOptions(t('erase.done'), { queue: true });
    }
  }, [erasedNotice, t]);

  return (
    <Screen bottomInset style={styles.screen}>
      <View style={styles.top}>
        <BrandHeader />
        <LanguageChoice />
      </View>
      <View style={styles.body}>
        <Emblems />
        <Text accessibilityRole="header" style={styles.title}>
          {t('onboarding.welcome.title')}
        </Text>
        <Text style={styles.paragraph}>{t('onboarding.welcome.promise')}</Text>
        <View style={styles.duration}>
          <ClockIcon color={colors.gold} size={22} />
          <Text style={styles.durationText}>{t('onboarding.welcome.duration')}</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Button label={t('onboarding.welcome.start')} onPress={onStart} />
        <Text style={styles.caption}>{t('onboarding.welcome.footer')}</Text>
      </View>
    </Screen>
  );
}

// The first emblem of each circle, a glimpse of the ranks ahead. Decoration.
const EMBLEMS = [
  { circle: 1, size: 36 },
  { circle: 2, size: 48 },
  { circle: 3, size: 62 },
  { circle: 4, size: 48 },
  { circle: 5, size: 40 },
] as const;

function Emblems() {
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={styles.emblems}
    >
      {EMBLEMS.map(({ circle, size }) => (
        <RankEmblem key={circle} circle={circle} tier={circle === 1 ? 1 : 2} unlocked size={size} />
      ))}
    </View>
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
        <GlobeIcon color={colors.accentText} size={20} />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.l,
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
    gap: spacing.l,
  },
  title: {
    ...typography.welcomeTitle,
    color: colors.text,
  },
  emblems: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.l,
    marginBottom: spacing.l,
  },
  paragraph: {
    ...typography.paragraph,
    fontSize: 18,
    lineHeight: 26,
    color: colors.textSecondary,
  },
  duration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  durationText: {
    ...typography.row,
    fontSize: 17,
    flexShrink: 1,
    color: colors.text,
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

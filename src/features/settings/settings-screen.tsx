import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { appVersion } from '@/features/settings/app-version';
import { chooseLanguage } from '@/features/settings/language-choice';
import { LanguageRow } from '@/features/settings/language-row';
import { planCountLabel } from '@/features/settings/labels';
import { useStorage } from '@/features/storage/storage-context';
import { i18n } from '@/lib/i18n';
import {
  getDeviceLanguage,
  languageOf,
  toPreference,
  type LanguagePreference,
} from '@/lib/i18n/language';
import { Button } from '@/ui/button';
import { NavRow } from '@/ui/nav-row';
import { RowGroup } from '@/ui/row-group';
import { Screen } from '@/ui/screen';
import { ScreenTitle } from '@/ui/screen-title';
import { ScrollView } from '@/ui/scroll-view';
import { colors, spacing, typography } from '@/ui/theme';

// Only what works in this version: the filter, reminders and the lock come with their features.
// The plan count and the language are read again each time the tab comes into focus, since the
// reasons and plans screen can change the first.
export function SettingsScreen() {
  const { t } = useTranslation();
  const storage = useStorage();
  const [planCount, setPlanCount] = useState<number | null>(null);
  const [preference, setPreference] = useState<LanguagePreference | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  // Bumped on each choice, so a read or a save started before a newer choice never lands.
  const choice = useRef(0);
  const version = appVersion();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const started = choice.current;
      void storage.profile.loadEntries().then((result) => {
        if (active && result.ok) setPlanCount(result.value.plans.length);
      });
      void storage.settings.loadLanguage().then((result) => {
        if (active && started === choice.current) {
          setPreference(toPreference(result.ok ? result.value : null));
        }
      });
      return () => {
        active = false;
      };
    }, [storage]),
  );

  async function choose(next: LanguagePreference) {
    const current = ++choice.current;
    setSaveFailed(false);
    const outcome = await chooseLanguage(
      {
        save: (preference) => storage.settings.saveLanguage(preference),
        apply: async (preference) => {
          setPreference(preference);
          await i18n.changeLanguage(languageOf(preference, getDeviceLanguage()));
        },
        isLatest: () => current === choice.current,
      },
      next,
    );
    if (outcome !== 'save-failed') return;
    setSaveFailed(true);
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(i18n.t('settings.languageSaveFailed'));
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenTitle>{t('tabs.settings')}</ScreenTitle>
        <RowGroup>
          <NavRow
            label={t('settings.reasonsAndPlans')}
            value={planCount === null ? undefined : planCountLabel(t, planCount)}
            onPress={() => router.push('/reasons-and-plans')}
          />
          <LanguageRow preference={preference} onChoose={(next) => void choose(next)} />
          <NavRow label={t('settings.about')} onPress={() => router.push('/about')} />
        </RowGroup>
        {saveFailed && (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
            {t('settings.languageSaveFailed')}
          </Text>
        )}
        <View style={styles.erase}>
          <Button
            variant="plain"
            label={t('settings.erase')}
            accessibilityHint={t('settings.eraseHint')}
            onPress={() => router.push('/erase')}
          />
        </View>
        {version !== undefined && (
          <Text style={styles.footer}>{t('settings.footer', { version })}</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // The footer sits at the bottom of the screen, or after the rows when they fill it.
  content: {
    flexGrow: 1,
    gap: spacing.xl,
    paddingBottom: spacing.l,
  },
  error: {
    ...typography.body,
    textAlign: 'center',
    color: colors.text,
  },
  erase: {
    alignItems: 'center',
  },
  footer: {
    ...typography.caption,
    marginTop: 'auto',
    textAlign: 'center',
    color: colors.textSecondary,
  },
});

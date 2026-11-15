import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { appVersion } from '@/features/settings/app-version';
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
  const version = appVersion();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void storage.profile.loadEntries().then((result) => {
        if (active && result.ok) setPlanCount(result.value.plans.length);
      });
      void storage.settings.loadLanguage().then((result) => {
        if (active) setPreference(toPreference(result.ok ? result.value : null));
      });
      return () => {
        active = false;
      };
    }, [storage]),
  );

  // Applied at once, then stored. If storing fails, the language stays for this run and the
  // message says the choice was not kept.
  async function chooseLanguage(next: LanguagePreference) {
    setSaveFailed(false);
    setPreference(next);
    await i18n.changeLanguage(languageOf(next, getDeviceLanguage()));
    const saved = await storage.settings.saveLanguage(next);
    if (saved.ok) return;
    setSaveFailed(true);
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(i18n.t('settings.saveFailed'));
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
          <LanguageRow preference={preference} onChoose={(next) => void chooseLanguage(next)} />
          <NavRow label={t('settings.about')} onPress={() => router.push('/about')} />
        </RowGroup>
        {saveFailed && (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
            {t('settings.saveFailed')}
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

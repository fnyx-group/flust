import { router } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  dialUrl,
  HELP_DIRECTORY,
  HELP_REGIONS,
  helpEntries,
  helpRegionFor,
  oldestCheck,
  type HelpAction,
  type HelpEntry,
  type HelpRegion,
} from '@/domain/help-resources';
import { deviceRegion } from '@/features/help/device-region';
import { HelpRows } from '@/features/help/help-row';
import { checkedMonth, openFailedMessage, regionLabel } from '@/features/help/labels';
import { openHelp } from '@/features/help/open-help';
import { displayUrl } from '@/features/settings/labels';
import { BackHeader } from '@/ui/back-header';
import { NavRow } from '@/ui/nav-row';
import { OptionSheet } from '@/ui/option-sheet';
import { RowGroup } from '@/ui/row-group';
import { Screen } from '@/ui/screen';
import { ScrollView } from '@/ui/scroll-view';
import { colors, spacing, typography } from '@/ui/theme';

// Calls and text messages open the phone's own apps, and the directory opens outside flust: flust
// itself sends nothing. The chosen country is not stored, and nothing records that this screen
// was opened.
export function HelpScreen() {
  const { t, i18n } = useTranslation();
  const [region] = useState(deviceRegion);
  const [chosen, setChosen] = useState<HelpRegion>(() => helpRegionFor(region));
  const [picking, setPicking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const entries = helpEntries(chosen, region);
  const listen = entries.filter((entry) => entry.kind === 'listen');
  const emergency = entries.filter((entry) => entry.kind === 'emergency');
  const withDirectory = chosen === 'other';
  const month = checkedMonth(
    i18n.language,
    oldestCheck(withDirectory ? [...entries, HELP_DIRECTORY] : entries),
  );

  async function open(url: string, failedMessage: string) {
    setFailure(null);
    if ((await openHelp((target) => Linking.openURL(target), url)) === 'opened') return;
    setFailure(failedMessage);
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(failedMessage);
  }

  function openEntry(entry: HelpEntry, action: HelpAction) {
    void open(dialUrl(entry, action), openFailedMessage(t, entry, action));
  }

  function choose(next: HelpRegion) {
    setChosen(next);
    setFailure(null);
  }

  const address = displayUrl(HELP_DIRECTORY.url);

  return (
    <Screen bottomInset>
      <BackHeader
        backLabel={t('help.back')}
        title={t('help.title')}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.paragraph}>{t('help.intro')}</Text>
        <RowGroup>
          <NavRow
            label={t('help.country')}
            value={regionLabel(t, chosen)}
            accessibilityHint={t('help.countryHint')}
            onPress={() => setPicking(true)}
          />
        </RowGroup>
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionLabel}>
            {t('help.listen')}
          </Text>
          {withDirectory && <Text style={styles.paragraph}>{t('help.directoryIntro')}</Text>}
          <RowGroup>
            {listen.map((entry) => (
              <HelpRows key={entry.id} entry={entry} onOpen={openEntry} />
            ))}
            {withDirectory && (
              <NavRow
                label={t('help.directory')}
                value={address}
                accessibilityRole="link"
                accessibilityHint={t('about.linkHint')}
                onPress={() => void open(HELP_DIRECTORY.url, t('help.linkFailed', { address }))}
              />
            )}
          </RowGroup>
        </View>
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionLabel}>
            {t('help.emergencies')}
          </Text>
          <RowGroup>
            {emergency.map((entry) => (
              <HelpRows key={entry.id} entry={entry} onOpen={openEntry} />
            ))}
          </RowGroup>
        </View>
        {failure !== null && (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.failure}>
            {failure}
          </Text>
        )}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('help.footer')}</Text>
          {month !== null && <Text style={styles.checked}>{t('help.checked', { month })}</Text>}
        </View>
      </ScrollView>
      <OptionSheet
        visible={picking}
        title={t('help.country')}
        closeLabel={t('onboarding.close')}
        options={HELP_REGIONS.map((key) => ({ key, label: regionLabel(t, key) }))}
        selected={chosen}
        onSelect={choose}
        onClose={() => setPicking(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.xl,
  },
  paragraph: {
    ...typography.paragraph,
    color: colors.textSecondary,
  },
  section: {
    gap: spacing.m,
  },
  sectionLabel: {
    ...typography.sectionLabel,
  },
  failure: {
    ...typography.paragraphSmall,
    color: colors.text,
  },
  footer: {
    gap: spacing.s,
  },
  footerText: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  checked: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.textSecondary,
  },
});

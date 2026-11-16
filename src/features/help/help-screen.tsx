import { router } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, Linking, StyleSheet, Text, View } from 'react-native';
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
import { HelpFailure, HelpRows } from '@/features/help/help-row';
import { checkedMonth, openFailedMessage, regionLabel } from '@/features/help/labels';
import { openHelp } from '@/features/help/open-help';
import { displayUrl } from '@/features/shared/display-url';
import { BackHeader } from '@/ui/back-header';
import { NavRow } from '@/ui/nav-row';
import { OptionSheet } from '@/ui/option-sheet';
import { RowGroup } from '@/ui/row-group';
import { Screen } from '@/ui/screen';
import { ScrollView } from '@/ui/scroll-view';
import { colors, spacing, typography } from '@/ui/theme';

type Failure = { key: string; message: string };

const DIRECTORY = 'directory';

// Calls and text messages open the phone's own apps, and the directory opens outside flust: flust
// itself sends nothing. The chosen country is not stored, and nothing records that this screen
// was opened.
export function HelpScreen() {
  const { t, i18n } = useTranslation();
  const [region] = useState(deviceRegion);
  const [chosen, setChosen] = useState<HelpRegion>(() => helpRegionFor(region));
  const [picking, setPicking] = useState(false);
  // The row that could not open, by entry id or "directory", and what to do by hand.
  const [failure, setFailure] = useState<Failure | null>(null);

  const entries = helpEntries(chosen, region);
  const listen = entries.filter((entry) => entry.kind === 'listen');
  const emergency = entries.filter((entry) => entry.kind === 'emergency');
  const withDirectory = chosen === 'other';
  const month = checkedMonth(
    i18n.language,
    oldestCheck(withDirectory ? [...entries, HELP_DIRECTORY] : entries),
  );

  // Announced on both platforms: an Android live region on a line that has just appeared is not
  // read reliably.
  async function open(url: string, failed: Failure) {
    setFailure(null);
    if ((await openHelp((target) => Linking.openURL(target), url)) === 'opened') return;
    setFailure(failed);
    AccessibilityInfo.announceForAccessibility(failed.message);
  }

  function openEntry(entry: HelpEntry, action: HelpAction) {
    void open(dialUrl(entry, action), {
      key: entry.id,
      message: openFailedMessage(t, entry, action),
    });
  }

  function failureOf(key: string): string | null {
    return failure?.key === key ? failure.message : null;
  }

  function choose(next: HelpRegion) {
    setChosen(next);
    setFailure(null);
  }

  const address = displayUrl(HELP_DIRECTORY.url);
  const directoryFailure = failureOf(DIRECTORY);

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
              <HelpRows
                key={entry.id}
                entry={entry}
                onOpen={openEntry}
                failure={failureOf(entry.id)}
              />
            ))}
            {withDirectory && (
              <View>
                <NavRow
                  label={t('help.directory')}
                  value={address}
                  accessibilityRole="link"
                  accessibilityHint={t('about.linkHint')}
                  onPress={() =>
                    void open(HELP_DIRECTORY.url, {
                      key: DIRECTORY,
                      message: t('help.linkFailed', { address }),
                    })
                  }
                />
                {directoryFailure !== null && <HelpFailure message={directoryFailure} />}
              </View>
            )}
          </RowGroup>
        </View>
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionLabel}>
            {t('help.emergencies')}
          </Text>
          <RowGroup>
            {emergency.map((entry) => (
              <HelpRows
                key={entry.id}
                entry={entry}
                onOpen={openEntry}
                failure={failureOf(entry.id)}
              />
            ))}
          </RowGroup>
        </View>
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

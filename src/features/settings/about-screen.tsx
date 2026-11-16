import { router } from 'expo-router';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { appVersion } from '@/features/settings/app-version';
import { SOURCE_URL, WEBSITE_URL } from '@/features/settings/labels';
import { displayUrl } from '@/features/shared/display-url';
import { BackHeader } from '@/ui/back-header';
import { NavRow } from '@/ui/nav-row';
import { RowGroup } from '@/ui/row-group';
import { Screen } from '@/ui/screen';
import { ScrollView } from '@/ui/scroll-view';
import { colors, spacing, typography } from '@/ui/theme';

// Links open outside flust, in the browser or the app that handles the address: flust itself
// sends nothing. The address shows next to each
// link, so it can be checked first, or typed if no browser opens.
export function AboutScreen() {
  const { t } = useTranslation();
  const version = appVersion();

  function open(url: string) {
    Linking.openURL(url).catch(() => undefined);
  }

  return (
    <Screen bottomInset>
      <BackHeader
        backLabel={t('about.back')}
        title={t('about.title')}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.text}>
          {version !== undefined && (
            <Text style={styles.version}>{t('about.version', { version })}</Text>
          )}
          <Text style={styles.paragraph}>{t('about.license')}</Text>
          <Text style={styles.paragraph}>{t('about.privacy')}</Text>
        </View>
        <RowGroup>
          <NavRow
            label={t('about.website')}
            value={displayUrl(WEBSITE_URL)}
            accessibilityRole="link"
            accessibilityHint={t('about.linkHint')}
            onPress={() => open(WEBSITE_URL)}
          />
          <NavRow
            label={t('about.source')}
            value={displayUrl(SOURCE_URL)}
            accessibilityRole="link"
            accessibilityHint={t('about.linkHint')}
            onPress={() => open(SOURCE_URL)}
          />
        </RowGroup>
        <Text style={styles.byline}>{t('about.byline')}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.xl,
  },
  text: {
    gap: spacing.m,
  },
  version: {
    ...typography.row,
    color: colors.text,
  },
  paragraph: {
    ...typography.paragraph,
    color: colors.textSecondary,
  },
  byline: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
  },
});

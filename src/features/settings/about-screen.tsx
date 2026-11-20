import { router } from 'expo-router';
import type { ComponentType } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { appVersion } from '@/features/settings/app-version';
import { SOURCE_URL, WEBSITE_URL } from '@/features/settings/labels';
import { displayUrl } from '@/features/shared/display-url';
import { BackHeader } from '@/ui/back-header';
import { AppIcon } from '@/ui/brand/app-icon';
import { IconTile } from '@/ui/icon-tile';
import { CodeIcon } from '@/ui/icons/code-icon';
import { DocumentIcon } from '@/ui/icons/document-icon';
import { GlobeIcon } from '@/ui/icons/globe-icon';
import type { IconProps } from '@/ui/icons/line-icon';
import { LockIcon } from '@/ui/icons/lock-icon';
import { NavRow } from '@/ui/nav-row';
import { RowGroup } from '@/ui/row-group';
import { Screen } from '@/ui/screen';
import { ScrollView } from '@/ui/scroll-view';
import { colors, radii, spacing, typography } from '@/ui/theme';

// Links open outside flust, in the browser or the app that handles the address: flust itself
// sends nothing. Screen readers hear the address with each link, so it can be checked first.
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
        <View style={styles.card}>
          <AppIcon size={64} />
          <View style={styles.identity}>
            <Text style={styles.name}>{t('app.name')}</Text>
            {version !== undefined && (
              <Text style={styles.version}>{t('about.version', { version })}</Text>
            )}
            <Text style={styles.byline}>{t('about.byline')}</Text>
          </View>
        </View>
        <View style={styles.facts}>
          <Fact icon={LockIcon} color={colors.teal} text={t('about.privacy')} />
          <Fact icon={CodeIcon} color={colors.gold} text={t('about.license')} />
        </View>
        <RowGroup>
          <NavRow
            label={t('about.website')}
            icon={{ icon: GlobeIcon, color: colors.accentText }}
            accessibilityRole="link"
            accessibilityHint={t('about.linkHint', { address: displayUrl(WEBSITE_URL) })}
            onPress={() => open(WEBSITE_URL)}
          />
          <NavRow
            label={t('about.source')}
            icon={{ icon: CodeIcon, color: colors.accent }}
            accessibilityRole="link"
            accessibilityHint={t('about.linkHint', { address: displayUrl(SOURCE_URL) })}
            onPress={() => open(SOURCE_URL)}
          />
          {/* The notices list what the Android build ships; the iPhone's come with lot 3. */}
          {Platform.OS === 'android' && (
            <NavRow
              label={t('about.licenses')}
              icon={{ icon: DocumentIcon, color: colors.textSecondary }}
              onPress={() => router.push('/licenses')}
            />
          )}
          <NavRow
            label={t('about.errorReport')}
            icon={{ icon: DocumentIcon, color: colors.textSecondary }}
            onPress={() => router.push('/error-report')}
          />
        </RowGroup>
      </ScrollView>
    </Screen>
  );
}

type FactProps = { icon: ComponentType<IconProps>; color: string; text: string };

function Fact({ icon, color, text }: FactProps) {
  return (
    <View style={styles.fact}>
      <IconTile icon={icon} color={color} />
      <Text style={styles.factText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.xl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.l,
    padding: spacing.card,
    borderRadius: radii.cardLarge,
    backgroundColor: colors.accentSurface,
  },
  identity: {
    flexShrink: 1,
  },
  name: {
    ...typography.brandLockup,
    color: colors.text,
  },
  version: {
    ...typography.row,
    color: colors.accentText,
  },
  byline: {
    ...typography.body,
    color: colors.textSecondary,
  },
  facts: {
    gap: spacing.l,
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.l,
  },
  factText: {
    ...typography.paragraph,
    flex: 1,
    paddingTop: spacing.xs,
    color: colors.text,
  },
});

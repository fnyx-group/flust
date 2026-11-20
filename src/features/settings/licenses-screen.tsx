import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LIST_LICENSES } from '@/features/settings/list-licenses';
import { BackHeader } from '@/ui/back-header';
import { Screen } from '@/ui/screen';
import { ScrollView } from '@/ui/scroll-view';
import { SectionLabel } from '@/ui/section-label';
import { colors, radii, spacing, typography } from '@/ui/theme';

// The licenses of the filter's list sources, which MIT asks to ship with the lists
// (docs/decisions/0039-filter-lists-and-licenses.md). Shown where the lists ship, on Android for
// now.
export function LicensesScreen() {
  const { t } = useTranslation();
  return (
    <Screen bottomInset>
      <BackHeader
        backLabel={t('licenses.back')}
        title={t('licenses.title')}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/about'))}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>{t('licenses.intro')}</Text>
        {LIST_LICENSES.map((entry) => (
          <View key={entry.source} style={styles.section}>
            <SectionLabel color={colors.accentText}>
              {t('licenses.source', { name: entry.name, license: entry.license })}
            </SectionLabel>
            <View style={styles.card}>
              <Text selectable style={styles.text}>
                {entry.text.trim()}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.xl,
  },
  intro: {
    ...typography.paragraph,
    color: colors.text,
  },
  section: {
    gap: spacing.m,
  },
  card: {
    padding: spacing.card,
    borderRadius: radii.cardLarge,
    backgroundColor: colors.surface,
  },
  text: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});

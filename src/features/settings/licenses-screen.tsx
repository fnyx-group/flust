import { router } from 'expo-router';
import { memo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LIST_LICENSES } from '@/features/settings/list-licenses';
import { THIRD_PARTY_LIBRARIES } from '@/features/settings/third-party-licenses';
import { BackHeader } from '@/ui/back-header';
import { MinusIcon } from '@/ui/icons/minus-icon';
import { PlusIcon } from '@/ui/icons/plus-icon';
import { Screen } from '@/ui/screen';
import { SectionList } from '@/ui/scroll-view';
import { SectionLabel } from '@/ui/section-label';
import { colors, pressedOpacity, radii, sizes, spacing, typography } from '@/ui/theme';

type Entry = {
  readonly key: string;
  readonly name: string;
  readonly version: string | null;
  readonly license: string;
  readonly text: string;
};

type Section = { readonly key: string; readonly title: string; readonly data: readonly Entry[] };

const LISTS: readonly Entry[] = LIST_LICENSES.map((entry) => ({
  key: `list:${entry.source}`,
  name: entry.name,
  version: null,
  license: entry.license,
  text: entry.text,
}));

const LIBRARIES: readonly Entry[] = THIRD_PARTY_LIBRARIES.map((library) => ({
  key: `library:${library.name}@${library.version}`,
  ...library,
}));

// The licenses of what flust ships: the sources of the filter's lists, which MIT asks to ship
// with them (docs/decisions/0039-filter-lists-and-licenses.md), and the libraries of the app
// (docs/decisions/0043-third-party-licenses.md). Each row opens its text, since a few hundred
// texts in full would make a list nobody can scroll. Shown on Android for now: the iPhone ships
// other native code, listed with lot 3.
export function LicensesScreen() {
  const { t } = useTranslation();
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = useCallback((key: string) => {
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);

  const sections: readonly Section[] = [
    { key: 'lists', title: t('licenses.lists'), data: LISTS },
    { key: 'libraries', title: t('licenses.libraries'), data: LIBRARIES },
  ];

  return (
    <Screen bottomInset>
      <BackHeader
        backLabel={t('licenses.back')}
        title={t('licenses.title')}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/about'))}
      />
      <SectionList<Entry, Section>
        sections={sections}
        keyExtractor={(entry) => entry.key}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<Text style={styles.intro}>{t('licenses.intro')}</Text>}
        renderSectionHeader={({ section }) => (
          <View style={styles.header}>
            <SectionLabel color={colors.accentText}>{section.title}</SectionLabel>
          </View>
        )}
        renderItem={({ item }) => (
          <LicenseRow entry={item} open={open.has(item.key)} onToggle={toggle} />
        )}
        ItemSeparatorComponent={Separator}
      />
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

type LicenseRowProps = { entry: Entry; open: boolean; onToggle: (key: string) => void };

const LicenseRow = memo(function LicenseRow({ entry, open, onToggle }: LicenseRowProps) {
  const { t } = useTranslation();
  const details =
    entry.version === null
      ? entry.license
      : t('licenses.details', { version: entry.version, license: entry.license });
  const Icon = open ? MinusIcon : PlusIcon;
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('licenses.rowLabel', { name: entry.name, details })}
        accessibilityHint={t(open ? 'licenses.hideText' : 'licenses.showText')}
        accessibilityState={{ expanded: open }}
        onPress={() => onToggle(entry.key)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.identity}>
          <Text style={styles.name}>{entry.name}</Text>
          <Text style={styles.details}>{details}</Text>
        </View>
        <Icon color={colors.textSecondary} size={sizes.icon} />
      </Pressable>
      {open && (
        <Text selectable style={styles.text}>
          {entry.text.trim()}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
  },
  intro: {
    ...typography.paragraph,
    color: colors.text,
  },
  header: {
    marginTop: spacing.xl,
    marginBottom: spacing.m,
  },
  separator: {
    height: spacing.s,
  },
  card: {
    borderRadius: radii.cardLarge,
    backgroundColor: colors.surface,
  },
  row: {
    minHeight: sizes.row,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingHorizontal: spacing.rowHorizontal,
    paddingVertical: spacing.rowVertical,
  },
  pressed: {
    opacity: pressedOpacity,
  },
  identity: {
    flex: 1,
  },
  name: {
    ...typography.row,
    color: colors.text,
  },
  details: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  text: {
    ...typography.caption,
    color: colors.textSecondary,
    paddingHorizontal: spacing.rowHorizontal,
    paddingBottom: spacing.card,
  },
});

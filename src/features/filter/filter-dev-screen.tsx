import { router, useFocusEffect } from 'expo-router';
import type { TFunction } from 'i18next';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  DEFAULT_FILTER_SETTINGS,
  type FilterMeasure,
  type FilterSettings,
  type FilterStatus,
} from '@/features/filter/filter-bridge';
import { filterBridge } from '@/features/filter/filter-native';
import { BackHeader } from '@/ui/back-header';
import { Button } from '@/ui/button';
import { RowGroup } from '@/ui/row-group';
import { Screen } from '@/ui/screen';
import { ScrollView } from '@/ui/scroll-view';
import { SwitchRow } from '@/ui/switch-row';
import { colors, spacing, typography } from '@/ui/theme';

const CATEGORIES = ['adult', 'aiNudify', 'aiCompanions', 'strict', 'youtubeStrict'] as const;

// The engine of the content filter, behind a development setting: switch it on and off, choose
// the categories and measure the lists. The product screens come with the filter's release.
export function FilterDevScreen() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<FilterStatus>({ available: false });
  const [settings, setSettings] = useState<FilterSettings>(DEFAULT_FILTER_SETTINGS);
  const [measure, setMeasure] = useState<FilterMeasure | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    const next = filterBridge.status();
    setStatus(next);
    if (next.available) setSettings(next.settings);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const timer = setInterval(refresh, 2000);
      return () => clearInterval(timer);
    }, [refresh]),
  );

  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    await action();
    refresh();
    setBusy(false);
  }

  async function turn(on: boolean) {
    if (!on) return filterBridge.stop();
    if (await filterBridge.requestConsent()) await filterBridge.start(settings);
  }

  function change(key: (typeof CATEGORIES)[number], value: boolean) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    if (status.available && status.enabled) void run(() => filterBridge.start(next));
  }

  return (
    <Screen bottomInset>
      <BackHeader
        backLabel={t('filterDev.back')}
        title={t('filterDev.title')}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text accessibilityLiveRegion="polite" style={styles.status}>
          {statusText(t, status)}
        </Text>
        <RowGroup>
          <SwitchRow
            title={t('filterDev.filter')}
            value={status.available && status.enabled}
            disabled={busy || !status.available}
            onChange={(value) => void run(() => turn(value))}
          />
        </RowGroup>
        <RowGroup>
          {CATEGORIES.map((key) => (
            <SwitchRow
              key={key}
              title={t(`filterDev.categories.${key}`)}
              value={settings[key]}
              disabled={busy || !status.available}
              onChange={(value) => change(key, value)}
            />
          ))}
        </RowGroup>
        <View style={styles.measure}>
          <Button
            label={t('filterDev.measure')}
            variant="secondary"
            disabled={busy || !status.available}
            onPress={() => void run(async () => setMeasure(await filterBridge.measure()))}
          />
          {measure !== null && (
            <Text style={styles.note}>
              {t('filterDev.measured', {
                entries: measure.entries,
                kilobytes: Math.round(measure.bytes / 1024),
                load: measure.loadMillis.toFixed(1),
                decide: measure.decideMicros.toFixed(2),
              })}
            </Text>
          )}
        </View>
        <Text style={styles.note}>{t('filterDev.note')}</Text>
      </ScrollView>
    </Screen>
  );
}

function statusText(t: TFunction, status: FilterStatus): string {
  if (!status.available) return t('filterDev.status.unavailable');
  if (status.running) return t('filterDev.status.running');
  if (status.stopReason !== null) return t(`filterDev.status.${status.stopReason}`);
  return t('filterDev.status.off');
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.l,
  },
  status: {
    ...typography.body,
    color: colors.text,
  },
  measure: {
    gap: spacing.m,
  },
  note: {
    ...typography.paragraph,
    color: colors.textSecondary,
  },
});

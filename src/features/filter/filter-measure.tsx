import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { FilterMeasure as Measure } from '@/features/filter/filter-bridge';
import { filterBridge } from '@/features/filter/filter-native';
import { Button } from '@/ui/button';
import { colors, spacing, typography } from '@/ui/theme';

// The size of the lists, the cost of a lookup and the phases of the last tunnel start, for the
// development build (docs/development/manual-checklist.md).
export function FilterMeasure() {
  const { t } = useTranslation();
  const [measure, setMeasure] = useState<Measure | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setMeasure(await filterBridge.measure());
    setBusy(false);
  }

  return (
    <View style={styles.container}>
      <Button
        label={t('filter.measure')}
        variant="secondary"
        disabled={busy}
        onPress={() => void run()}
      />
      {measure !== null && (
        <Text style={styles.note}>
          {t('filter.measured', {
            entries: measure.entries,
            kilobytes: Math.round(measure.bytes / 1024),
            load: measure.loadMillis.toFixed(1),
            decide: measure.decideMicros.toFixed(2),
          })}
        </Text>
      )}
      {measure !== null && (
        <Text style={styles.note}>
          {measure.start === null
            ? t('filter.measuredNoStart')
            : t(measure.start.listsCached ? 'filter.measuredStartCached' : 'filter.measuredStart', {
                lists: measure.start.listsMillis.toFixed(1),
                trust: measure.start.trustMillis.toFixed(1),
                establish: measure.start.establishMillis.toFixed(1),
                total: measure.start.totalMillis.toFixed(1),
              })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.m,
  },
  note: {
    ...typography.paragraph,
    color: colors.textSecondary,
  },
});

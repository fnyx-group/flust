import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { quoteOfTheDay } from '@/domain/quotes';
import type { Timestamp } from '@/domain/time';
import { useClock } from '@/features/home/clock-context';
import { deviceOffsetAt } from '@/features/shared/device-time';
import { colors, typography } from '@/ui/theme';

// The selected quote is one of the QUOTES objects, the same all day, so ticks within a day do not
// re-render this component.
export function DailyQuote({ start }: { start: Timestamp }) {
  const { t } = useTranslation();
  const quote = useClock((now) => quoteOfTheDay(start, now, deviceOffsetAt));
  return (
    <View style={styles.container}>
      <Text style={typography.sectionLabel}>{t('home.quote.title')}</Text>
      <Text style={styles.text}>{t('home.quote.text', { text: t(`quotes.${quote.id}`) })}</Text>
      {quote.author && <Text style={styles.author}>{t(`quoteAuthors.${quote.author}`)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  text: {
    ...typography.quote,
    color: colors.text,
  },
  author: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
  },
});

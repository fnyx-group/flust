import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { quoteOfTheDay } from '@/domain/quotes';
import type { Timestamp } from '@/domain/time';
import { useClock } from '@/features/clock/clock-context';
import { spokenQuote } from '@/features/home/labels';
import { deviceOffsetAt } from '@/features/shared/device-time';
import { colors, spacing, typography } from '@/ui/theme';

// The selected quote is one of the QUOTES objects, the same all day, so ticks within a day do not
// re-render this component.
export function DailyQuote({ start }: { start: Timestamp }) {
  const { t } = useTranslation();
  const quote = useClock((now) => quoteOfTheDay(start, now, deviceOffsetAt));
  const text = t(`quotes.${quote.id}`);
  const author = quote.author && t(`quoteAuthors.${quote.author}`);
  return (
    <View accessible accessibilityLabel={spokenQuote(t, text, author)} style={styles.container}>
      <Text style={styles.label}>{t('home.quote.label')}</Text>
      <Text style={styles.text}>{text}</Text>
      {author !== null && <Text style={styles.author}>{author}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.s,
  },
  label: {
    ...typography.quoteLabel,
    color: colors.accentText,
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

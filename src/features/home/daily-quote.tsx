import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { quoteOfTheDay } from '@/domain/quotes';
import type { Timestamp } from '@/domain/time';
import { useClock } from '@/features/home/clock-context';
import { spokenQuote } from '@/features/home/labels';
import { deviceOffsetAt } from '@/features/shared/device-time';
import { colors, sizes, spacing, typography } from '@/ui/theme';

// The selected quote is one of the QUOTES objects, the same all day, so ticks within a day do not
// re-render this component.
export function DailyQuote({ start }: { start: Timestamp }) {
  const { t } = useTranslation();
  const quote = useClock((now) => quoteOfTheDay(start, now, deviceOffsetAt));
  const text = t('home.quote.text', { text: t(`quotes.${quote.id}`) });
  const author = quote.author && t(`quoteAuthors.${quote.author}`);
  return (
    <View accessible accessibilityLabel={spokenQuote(t, text, author)} style={styles.container}>
      <View style={styles.bar} />
      <View style={styles.texts}>
        <Text style={styles.text}>{text}</Text>
        {author !== null && <Text style={styles.author}>{author}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.m,
  },
  bar: {
    width: sizes.quoteBarWidth,
    borderRadius: sizes.quoteBarWidth / 2,
    backgroundColor: colors.accent,
  },
  texts: {
    flex: 1,
    gap: spacing.s,
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

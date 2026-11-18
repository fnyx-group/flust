import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { quoteOfTheDay } from '@/domain/quotes';
import type { Timestamp } from '@/domain/time';
import { useClock } from '@/features/clock/clock-context';
import { spokenQuote } from '@/features/home/labels';
import { deviceOffsetAt } from '@/features/shared/device-time';
import { colors, spacing, typography } from '@/ui/theme';

// At most this many lines of quote, the author's line aside; screen readers read the whole quote.
const QUOTE_LINES = 2;

// One discreet line or two, without a label, then the author when there is one, so the ring
// stays the focus. The selected quote is one of the QUOTES objects, the same all day, so ticks
// within a day do not re-render this component.
export function DailyQuote({ start }: { start: Timestamp }) {
  const { t } = useTranslation();
  const quote = useClock((now) => quoteOfTheDay(start, now, deviceOffsetAt));
  const text = t(`quotes.${quote.id}`);
  const author = quote.author && t(`quoteAuthors.${quote.author}`);
  return (
    <View accessible accessibilityLabel={spokenQuote(t, text, author)} style={styles.container}>
      <Text numberOfLines={QUOTE_LINES} style={styles.text}>
        {text}
      </Text>
      {author !== null && <Text style={styles.author}>{author}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  text: {
    ...typography.paragraph,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  author: {
    ...typography.quoteAuthor,
    textAlign: 'center',
    color: colors.muted,
  },
});

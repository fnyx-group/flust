import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/ui/screen';
import { ScreenTitle } from '@/ui/screen-title';
import { colors, spacing, typography } from '@/ui/theme';

type MessageScreenProps = {
  title: string;
  paragraphs: readonly string[];
  actions: ReactNode;
  // A short line above the actions, announced when it appears.
  notice?: string | null;
};

export function MessageScreen({ title, paragraphs, actions, notice = null }: MessageScreenProps) {
  return (
    <Screen bottomInset>
      <View style={styles.content}>
        <ScreenTitle>{title}</ScreenTitle>
        {paragraphs.map((paragraph) => (
          <Text key={paragraph} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}
      </View>
      <View style={styles.actions}>
        {notice !== null && (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>
            {notice}
          </Text>
        )}
        {actions}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: spacing.l,
  },
  paragraph: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
  },
  notice: {
    ...typography.paragraphSmall,
    color: colors.text,
  },
  actions: {
    gap: spacing.m,
  },
});

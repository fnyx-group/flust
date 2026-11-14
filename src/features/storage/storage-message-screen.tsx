import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/ui/screen';
import { ScreenTitle } from '@/ui/screen-title';
import { colors, spacing, typography } from '@/ui/theme';

type StorageMessageScreenProps = {
  title: string;
  paragraphs: readonly string[];
  actions: ReactNode;
};

export function StorageMessageScreen({ title, paragraphs, actions }: StorageMessageScreenProps) {
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
      <View style={styles.actions}>{actions}</View>
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
  actions: {
    gap: spacing.m,
  },
});

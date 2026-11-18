import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import { colors, typography } from '@/ui/theme';

type SectionLabelProps = { children: ReactNode; color?: string };

// Sentence case, never uppercase: the color tells the sections apart.
export function SectionLabel({ children, color = colors.textSecondary }: SectionLabelProps) {
  return (
    <Text accessibilityRole="header" style={[styles.label, { color }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.sectionLabel,
  },
});

import { StyleSheet, Text } from 'react-native';

import { colors, typography } from '@/ui/theme';

export function ScreenTitle({ children }: { children: string }) {
  return (
    <Text style={styles.title} accessibilityRole="header">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.screenTitle,
    color: colors.text,
  },
});

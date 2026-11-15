import { StyleSheet, Text, View } from 'react-native';

import { LockIcon } from '@/ui/icons/lock-icon';
import { colors, spacing, typography } from '@/ui/theme';

// The line that says where the data stays. The lock is decoration: the text says it all.
export function PrivateLine({ text }: { text: string }) {
  return (
    <View style={styles.line}>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <LockIcon color={colors.textSecondary} size={16} />
      </View>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s,
  },
  text: {
    ...typography.body,
    flexShrink: 1,
    textAlign: 'center',
    color: colors.textSecondary,
  },
});

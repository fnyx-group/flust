import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/ui/icon-button';
import { BackIcon } from '@/ui/icons/back-icon';
import { ScreenTitle } from '@/ui/screen-title';
import { colors, spacing } from '@/ui/theme';

type BackHeaderProps = {
  backLabel: string;
  onBack: () => void;
  title?: string;
  disabled?: boolean;
  // An action on the right, such as a save button.
  action?: ReactNode;
};

export function BackHeader({ backLabel, onBack, title, disabled, action }: BackHeaderProps) {
  return (
    <View style={styles.header}>
      <IconButton accessibilityLabel={backLabel} disabled={disabled} onPress={onBack}>
        <BackIcon color={colors.text} size={20} />
      </IconButton>
      <View style={styles.title}>{title !== undefined && <ScreenTitle>{title}</ScreenTitle>}</View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.l,
    marginBottom: spacing.xl,
  },
  title: {
    flex: 1,
  },
});

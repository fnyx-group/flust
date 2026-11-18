import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/ui/icon-button';
import { BackIcon } from '@/ui/icons/back-icon';
import { ScreenTitle } from '@/ui/screen-title';
import { colors, sizes, spacing } from '@/ui/theme';

type BackHeaderProps = {
  backLabel: string;
  onBack: () => void;
  title?: string;
  disabled?: boolean;
  // An action on the right, such as a save button.
  action?: ReactNode;
};

// The back button and any action on one row, the title under them.
export function BackHeader({ backLabel, onBack, title, disabled, action }: BackHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.row}>
        <IconButton accessibilityLabel={backLabel} disabled={disabled} onPress={onBack}>
          <BackIcon color={colors.text} size={sizes.icon} />
        </IconButton>
        {action}
      </View>
      {title !== undefined && <ScreenTitle>{title}</ScreenTitle>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.l,
    marginBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.l,
  },
});

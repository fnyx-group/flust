import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/ui/theme';

type ScreenProps = {
  children: ReactNode;
  // Tab screens leave the bottom inset to the tab bar.
  bottomInset?: boolean;
  style?: ViewStyle;
};

export function Screen({ children, bottomInset = false, style }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(spacing.screenTop, insets.top),
          paddingBottom: bottomInset ? insets.bottom + spacing.screen : spacing.screen,
          paddingLeft: insets.left + spacing.screen,
          paddingRight: insets.right + spacing.screen,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

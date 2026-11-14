import type { BottomTabBarButtonProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radii } from '@/ui/theme';

// Replaces the default Android ripple, which is borderless and spreads over the neighboring tabs,
// with a highlight that stays inside the tab, the same on both platforms. Only the props a
// Pressable understands are passed on; the others are for the web or for the default ripple.
export function TabBarButton({
  children,
  style,
  onPress,
  onLongPress,
  testID,
  role,
  'aria-label': ariaLabel,
  'aria-selected': ariaSelected,
  accessibilityLargeContentTitle,
  accessibilityShowsLargeContentViewer,
}: BottomTabBarButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      testID={testID}
      role={role}
      aria-label={ariaLabel}
      aria-selected={ariaSelected}
      accessibilityLargeContentTitle={accessibilityLargeContentTitle}
      accessibilityShowsLargeContentViewer={accessibilityShowsLargeContentViewer}
      style={style}
    >
      {({ pressed }) => (
        <>
          <View style={[styles.highlight, pressed && styles.pressed]} />
          {children}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  highlight: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    right: 4,
    pointerEvents: 'none',
    borderRadius: radii.tabHighlight,
  },
  pressed: {
    backgroundColor: colors.surface,
  },
});

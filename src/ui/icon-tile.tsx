import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import type { IconProps } from '@/ui/icons/line-icon';
import { radii, sizes, tint, tintAlpha } from '@/ui/theme';

type IconTileProps = { icon: ComponentType<IconProps>; color: string };

// The icon of a row on a faint square of its own color. Decoration: the row's label says it all.
export function IconTile({ icon: Icon, color }: IconTileProps) {
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.tile, { backgroundColor: tint(color, tintAlpha.tile) }]}
    >
      <Icon color={color} size={sizes.icon} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: sizes.iconTile,
    height: sizes.iconTile,
    borderRadius: radii.iconTile,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

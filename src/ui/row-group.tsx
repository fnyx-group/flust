import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radii } from '@/ui/theme';

// A card of rows, with a separator line between them.
export function RowGroup({ children }: { children: ReactNode }) {
  return (
    <View style={styles.card}>
      {Children.toArray(children).map((child, index) => (
        <View key={index} style={index > 0 && styles.separated}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.cardLarge,
    overflow: 'hidden',
  },
  separated: {
    borderTopWidth: 1,
    borderTopColor: colors.separator,
  },
});

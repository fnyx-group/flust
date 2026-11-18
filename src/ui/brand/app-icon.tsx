import { StyleSheet, View } from 'react-native';

import { FlustSymbol } from '@/ui/brand/flust-symbol';
import { colors } from '@/ui/theme';

type AppIconProps = { size: number; backgroundColor?: string };

// The symbol on its rounded square, as on the home screen of the phone.
export function AppIcon({ size, backgroundColor = colors.background }: AppIconProps) {
  return (
    <View
      style={[
        styles.icon,
        { width: size, height: size, borderRadius: size * 0.27, backgroundColor },
      ]}
    >
      <FlustSymbol height={size * 0.58} />
    </View>
  );
}

const styles = StyleSheet.create({
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

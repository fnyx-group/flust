import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FlustSymbol } from '@/ui/brand/flust-symbol';
import { colors, spacing, typography } from '@/ui/theme';

export function BrandHeader() {
  const { t } = useTranslation();
  return (
    <View style={styles.container} accessibilityRole="header">
      <FlustSymbol height={26} />
      <Text style={styles.name}>{t('app.name')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
  // Fits the 44 point row of the screen titles. A shorter line would cut the top of "f", "l"
  // and "t" on Android, which keeps the font's descent and trims its ascent.
  name: {
    ...typography.brandLockup,
    lineHeight: 40,
    includeFontPadding: false,
    color: colors.text,
  },
});

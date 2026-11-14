import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FlustSymbol } from '@/ui/brand/flust-symbol';
import { colors, spacing, typography } from '@/ui/theme';

// The large symbol and name of the welcome screen; BrandHeader is the small one of the home.
export function BrandLockup() {
  const { t } = useTranslation();
  return (
    <View style={styles.container} accessible accessibilityRole="header">
      <FlustSymbol height={36} />
      <Text style={styles.name}>{t('app.name')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.l,
  },
  name: {
    ...typography.brandLockup,
    color: colors.text,
  },
});

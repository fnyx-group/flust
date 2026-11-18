import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppIcon } from '@/ui/brand/app-icon';
import { colors, spacing, typography } from '@/ui/theme';

// The app icon over the name, centered, for the lock screen and its cover; BrandHeader is the
// symbol beside the name, for the home and the welcome screen.
export function BrandLockup() {
  const { t } = useTranslation();
  return (
    <View style={styles.container} accessible accessibilityRole="header">
      <AppIcon size={120} backgroundColor={colors.accentSurface} />
      <Text style={styles.name}>{t('app.name')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.xl,
  },
  name: {
    ...typography.unlockRankName,
    color: colors.text,
  },
});

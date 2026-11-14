import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FlustSymbol } from '@/ui/brand/flust-symbol';
import { colors, typography } from '@/ui/theme';

export function BrandHeader() {
  const { t } = useTranslation();
  return (
    <View style={styles.container} accessibilityRole="header">
      <FlustSymbol height={24} />
      <Text style={styles.name}>{t('app.name')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  name: {
    ...typography.screenTitle,
    color: colors.text,
  },
});

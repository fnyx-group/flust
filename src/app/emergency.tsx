import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { IconButton } from '@/ui/icon-button';
import { CloseIcon } from '@/ui/icons/close-icon';
import { Screen } from '@/ui/screen';
import { ScreenTitle } from '@/ui/screen-title';
import { colors, spacing } from '@/ui/theme';

export default function EmergencyScreen() {
  const { t } = useTranslation();
  return (
    <Screen bottomInset>
      <View style={styles.header}>
        <IconButton accessibilityLabel={t('emergency.close')} onPress={() => router.back()}>
          <CloseIcon color={colors.text} />
        </IconButton>
      </View>
      <ScreenTitle>{t('emergency.title')}</ScreenTitle>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    marginBottom: spacing.screen,
  },
});

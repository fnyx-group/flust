import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BrandHeader } from '@/ui/brand/brand-header';
import { Button } from '@/ui/button';
import { Screen } from '@/ui/screen';

export default function HomeScreen() {
  const { t } = useTranslation();
  return (
    <Screen style={styles.container}>
      <BrandHeader />
      <Button label={t('home.urgeButton')} onPress={() => router.push('/emergency')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
  },
});

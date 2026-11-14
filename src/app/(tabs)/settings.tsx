import { useTranslation } from 'react-i18next';

import { Screen } from '@/ui/screen';
import { ScreenTitle } from '@/ui/screen-title';

export default function SettingsScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <ScreenTitle>{t('tabs.settings')}</ScreenTitle>
    </Screen>
  );
}

import { useTranslation } from 'react-i18next';

import { Screen } from '@/ui/screen';
import { ScreenTitle } from '@/ui/screen-title';

export default function RanksScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <ScreenTitle>{t('tabs.ranks')}</ScreenTitle>
    </Screen>
  );
}

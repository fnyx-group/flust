import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/ui/button';
import { MessageScreen } from '@/ui/message-screen';

export function NotFoundScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <MessageScreen
      title={t('errors.notFound.title')}
      paragraphs={[t('errors.notFound.body')]}
      actions={<Button label={t('errors.notFound.home')} onPress={() => router.dismissTo('/')} />}
    />
  );
}

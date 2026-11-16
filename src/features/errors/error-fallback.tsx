import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { recordError } from '@/features/errors/report-error';
import { StorageMessageScreen } from '@/features/storage/storage-message-screen';
import { Button } from '@/ui/button';

type ErrorFallbackProps = {
  onRetry: () => void;
  // Left out where there is no home to go back to, or where home is the screen that failed.
  onHome?: () => void;
};

// Static text only: nothing from the tree that failed is shown, so no half-built state reaches
// the screen. No red and no animation.
export function ErrorFallback({ onRetry, onHome }: ErrorFallbackProps) {
  const { t } = useTranslation();
  return (
    <StorageMessageScreen
      title={t('errors.fallback.title')}
      paragraphs={[t('errors.fallback.body')]}
      actions={
        <>
          <Button label={t('errors.fallback.retry')} onPress={onRetry} />
          {onHome !== undefined && (
            <Button variant="plain" label={t('errors.fallback.home')} onPress={onHome} />
          )}
        </>
      }
    />
  );
}

// Expo Router's boundary only renders the fallback, so the fallback records what it caught.
export function useRecordRenderError(error: Error, route: string | null): void {
  useEffect(() => {
    void recordError(error, { kind: 'render', route });
  }, [error, route]);
}

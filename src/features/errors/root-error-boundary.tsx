import type { ErrorBoundaryProps } from 'expo-router';
import { I18nextProvider, useTranslation } from 'react-i18next';

import { useRecordRenderError } from '@/features/errors/error-fallback';
import { StorageMessageScreen } from '@/features/storage/storage-message-screen';
import { i18n } from '@/lib/i18n';
import { Button } from '@/ui/button';

// Catches what the screen boundaries cannot: the gates of the root layout. It sits above the
// providers, so it brings its own translations and reads no storage or session. Trying again
// mounts the layout again, which counts as a new launch, so a failure that repeats during startup
// leads to safe mode. See docs/decisions/0028-error-boundaries-and-safe-mode.md.
export function RootErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useRecordRenderError(error, null);
  return (
    <I18nextProvider i18n={i18n}>
      <RootFallback onRetry={() => void retry()} />
    </I18nextProvider>
  );
}

function RootFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <StorageMessageScreen
      title={t('errors.root.title')}
      paragraphs={[t('errors.root.body')]}
      actions={<Button label={t('errors.root.retry')} onPress={onRetry} />}
    />
  );
}

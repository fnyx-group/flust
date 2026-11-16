import { router, usePathname, type ErrorBoundaryProps } from 'expo-router';

import { ErrorFallback, useRecordRenderError } from '@/features/errors/error-fallback';

// Exported as `ErrorBoundary` by each route, so a failing screen leaves the tab bar, the other
// screens and the lock cover working.
export function ScreenErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const pathname = usePathname();
  useRecordRenderError(error, pathname);
  const atHome = pathname === '/';
  return (
    <ErrorFallback
      onRetry={() => void retry()}
      onHome={atHome ? undefined : () => router.dismissTo('/')}
    />
  );
}

// For the onboarding, which has no home behind it yet.
export function RetryOnlyErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const pathname = usePathname();
  useRecordRenderError(error, pathname);
  return <ErrorFallback onRetry={() => void retry()} />;
}

import { useRouter, useRoute, type ErrorBoundaryProps } from 'expo-router';

import { routeFromName } from '@/domain/error-log';
import { ErrorFallback, useRecordRenderError } from '@/features/errors/error-fallback';

// Exported as `ErrorBoundary` by each route, so a failing screen leaves the tab bar, the other
// screens and the lock cover working.
export function ScreenErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const router = useRouter();
  const route = useFailedRoute();
  useRecordRenderError(error, route);
  const atHome = route === HOME;
  return (
    <ErrorFallback
      onRetry={() => void retry()}
      onHome={atHome ? undefined : () => router.dismissTo('/')}
    />
  );
}

// For the onboarding, which has no home behind it yet.
export function RetryOnlyErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useRecordRenderError(error, useFailedRoute());
  return <ErrorFallback onRetry={() => void retry()} />;
}

const HOME = routeFromName('index');

// The boundary renders inside the screen that failed, so its route is that screen's, even when
// another one has the focus. Its name is the file's pattern, "[id]" rather than the id itself.
function useFailedRoute(): string {
  return routeFromName(useRoute().name);
}

import { NotFoundScreen } from '@/features/navigation/not-found-screen';

export { ScreenErrorBoundary as ErrorBoundary } from '@/features/errors/screen-error-boundary';

export default function NotFoundRoute() {
  return <NotFoundScreen />;
}

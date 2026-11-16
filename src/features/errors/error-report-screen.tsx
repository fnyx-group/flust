import { router } from 'expo-router';

import { ErrorReportView } from '@/features/errors/error-report-view';

export function ErrorReportScreen() {
  return (
    <ErrorReportView
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/about'))}
    />
  );
}

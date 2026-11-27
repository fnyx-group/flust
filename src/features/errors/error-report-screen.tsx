import { ErrorReportView } from '@/features/errors/error-report-view';
import { useGoBack } from '@/features/navigation/use-go-back';

export function ErrorReportScreen() {
  const goBack = useGoBack('/about');
  return <ErrorReportView onBack={goBack} />;
}

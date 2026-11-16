import { useLocalSearchParams } from 'expo-router';

import { ReasonScreen } from '@/features/profile/reason-screen';

export { ScreenErrorBoundary as ErrorBoundary } from '@/features/errors/screen-error-boundary';

export default function ReasonRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <ReasonScreen idParam={id} />;
}

import { useLocalSearchParams } from 'expo-router';

import { PlanScreen } from '@/features/profile/plan-screen';

export { ScreenErrorBoundary as ErrorBoundary } from '@/features/errors/screen-error-boundary';

export default function PlanRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <PlanScreen idParam={id} />;
}

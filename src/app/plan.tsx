import { useLocalSearchParams } from 'expo-router';

import { PlanScreen } from '@/features/profile/plan-screen';

export default function PlanRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <PlanScreen idParam={id} />;
}

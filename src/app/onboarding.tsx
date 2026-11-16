import { OnboardingScreen } from '@/features/onboarding/onboarding-screen';

export { RetryOnlyErrorBoundary as ErrorBoundary } from '@/features/errors/screen-error-boundary';

export default function OnboardingRoute() {
  return <OnboardingScreen />;
}

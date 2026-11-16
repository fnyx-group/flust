import { useWindowDimensions } from 'react-native';

import { largeTextScale } from '@/ui/theme';

// Follows the system text size as it changes, like every text does.
export function useLargeText(): boolean {
  return useWindowDimensions().fontScale > largeTextScale;
}

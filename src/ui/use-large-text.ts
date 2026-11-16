import { useWindowDimensions } from 'react-native';

import { largeTextScale } from '@/ui/theme';

// Read from the window rather than once, so layouts switch as soon as the text size changes.
export function useLargeText(): boolean {
  return useWindowDimensions().fontScale > largeTextScale;
}

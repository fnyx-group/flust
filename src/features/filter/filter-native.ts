import { requireOptionalNativeModule } from 'expo';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { createFilterBridge, type NativeFilter } from '@/features/filter/filter-bridge';

// modules/flust-filter, on Android only. Null elsewhere, which the bridge reads as unavailable:
// the iPhone filter comes with lot 3 (docs/product/content-filter.md, Delivery).
export const filterBridge = createFilterBridge(
  Platform.OS === 'android' ? requireOptionalNativeModule<NativeFilter>('FlustFilter') : null,
);

// The filter is offered where its VPN service is declared.
export function filterOffered(): boolean {
  return filterBridge.status().available;
}

// The measure of the lists, for the development build only.
export function filterMeasureOn(): boolean {
  return Constants.expoConfig?.extra?.filterMeasure === true;
}

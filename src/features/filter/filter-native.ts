import { requireOptionalNativeModule } from 'expo';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { createFilterBridge, type NativeFilter } from '@/features/filter/filter-bridge';

// modules/flust-filter, on Android only. Null elsewhere, which the bridge reads as unavailable.
export const filterBridge = createFilterBridge(
  Platform.OS === 'android' ? requireOptionalNativeModule<NativeFilter>('FlustFilter') : null,
);

// The filter runs behind a development setting until the release that ships it
// (docs/decisions/0033-android-filter-network-access.md).
export function filterDevSettingOn(): boolean {
  return Platform.OS === 'android' && Constants.expoConfig?.extra?.filterDevSetting === true;
}

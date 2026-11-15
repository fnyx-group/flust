import Constants from 'expo-constants';

// Off in the development build only, so screenshots can be taken for the docs. A config that
// cannot be read keeps the protection.
export function screenPrivacyOn(): boolean {
  return Constants.expoConfig?.extra?.screenPrivacy !== false;
}

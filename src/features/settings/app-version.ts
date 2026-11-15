import Constants from 'expo-constants';

// The version from the app config, the same one the stores show. Undefined only if the config
// cannot be read, when screens leave the version out rather than show a wrong one.
export function appVersion(): string | undefined {
  return Constants.expoConfig?.version;
}

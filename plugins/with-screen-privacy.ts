import { AndroidConfig, withAndroidManifest, type ConfigPlugin } from 'expo/config-plugins';

// Read by modules/flust-privacy when the activity is created, so FLAG_SECURE is set before the
// first frame, without waiting for JavaScript. A build without it is protected.
export const SCREEN_PRIVACY_META_DATA = 'org.fnyxgroup.flust.privacy.SCREEN_PRIVACY';

export function setScreenPrivacy(
  manifest: AndroidConfig.Manifest.AndroidManifest,
  on: boolean,
): AndroidConfig.Manifest.AndroidManifest {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  AndroidConfig.Manifest.addMetaDataItemToMainApplication(
    application,
    SCREEN_PRIVACY_META_DATA,
    String(on),
  );
  return manifest;
}

export const withScreenPrivacy: ConfigPlugin<boolean> = (config, on) =>
  withAndroidManifest(config, (mod) => {
    mod.modResults = setScreenPrivacy(mod.modResults, on);
    return mod;
  });

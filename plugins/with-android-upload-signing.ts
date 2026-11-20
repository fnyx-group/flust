import { withAppBuildGradle, type ConfigPlugin } from 'expo/config-plugins';

const MARKER = '// flust: release signing and native symbols';

// Appended after the template's android block, so that it overrides the debug signing the template
// gives the release build type. Which key signs is decided by plugins/android-upload-signing.gradle,
// which its tests run on their own. See docs/decisions/0046-android-bundle-and-upload-key.md.
export const RELEASE_SIGNING = `
${MARKER} (plugins/with-android-upload-signing.ts)
apply from: new File(rootDir, '../plugins/android-upload-signing.gradle')
def flustUploadKey = flustUploadKeyFrom { findProperty(it) }
android {
    signingConfigs {
        if (flustUploadKey) {
            upload {
                storeFile file(flustUploadKey.flustUploadStoreFile)
                storePassword flustUploadKey.flustUploadStorePassword
                keyAlias flustUploadKey.flustUploadKeyAlias
                keyPassword flustUploadKey.flustUploadKeyPassword
            }
        }
    }
    buildTypes {
        release {
            // Without the upload key, the template's debug key signs local and CI builds, which
            // scripts/check-android-release.sh requires and Google Play refuses.
            signingConfig flustUploadKey ? signingConfigs.upload : signingConfigs.debug
            // Symbol tables of the native libraries in the bundle, for Play's crash reports.
            ndk {
                debugSymbolLevel 'SYMBOL_TABLE'
            }
        }
    }
}
`;

export function addReleaseSigning(buildGradle: string): string {
  if (buildGradle.includes(MARKER)) return buildGradle;
  return `${buildGradle.trimEnd()}\n${RELEASE_SIGNING}`;
}

export const withAndroidUploadSigning: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      throw new Error('app/build.gradle is expected in Groovy.');
    }
    mod.modResults.contents = addReleaseSigning(mod.modResults.contents);
    return mod;
  });

import { withAppBuildGradle, type ConfigPlugin } from 'expo/config-plugins';

// The Gradle properties of the upload key, which Gradle reads from ~/.gradle/gradle.properties or
// from ORG_GRADLE_PROJECT_<name> environment variables, never from the repository.
export const UPLOAD_KEY_PROPERTIES = [
  'flustUploadStoreFile',
  'flustUploadStorePassword',
  'flustUploadKeyAlias',
  'flustUploadKeyPassword',
] as const;

export const REQUIRE_UPLOAD_KEY_PROPERTY = 'flustRequireUploadKey';

const MARKER = '// flust: release signing and native symbols';

// Appended after the template's android block, so that it overrides the debug signing the template
// gives the release build type. See docs/decisions/0046-android-bundle-and-upload-key.md.
export const RELEASE_SIGNING = `
${MARKER} (plugins/with-android-upload-signing.ts)
def flustUploadProperties = [${UPLOAD_KEY_PROPERTIES.map((name) => `'${name}'`).join(', ')}]
def flustUploadSet = flustUploadProperties.findAll { findProperty(it) }
if (!flustUploadSet.isEmpty() && flustUploadSet.size() != flustUploadProperties.size()) {
    throw new GradleException("Set all of \${flustUploadProperties.join(', ')} to sign with the upload key, or none of them. Missing: \${(flustUploadProperties - flustUploadSet).join(', ')}.")
}
def flustUploadKey = !flustUploadSet.isEmpty()
if (!flustUploadKey && (findProperty('${REQUIRE_UPLOAD_KEY_PROPERTY}') ?: 'false').toBoolean()) {
    throw new GradleException("${REQUIRE_UPLOAD_KEY_PROPERTY} is set and the upload key is not: see docs/development/release.md.")
}
android {
    signingConfigs {
        if (flustUploadKey) {
            upload {
                storeFile file(findProperty('flustUploadStoreFile'))
                storePassword findProperty('flustUploadStorePassword')
                keyAlias findProperty('flustUploadKeyAlias')
                keyPassword findProperty('flustUploadKeyPassword')
            }
        }
    }
    buildTypes {
        release {
            // Without the upload key, the debug key signs local and CI builds, which
            // scripts/check-android-release.sh reports and Google Play refuses.
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

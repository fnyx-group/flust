import {
  addReleaseSigning,
  REQUIRE_UPLOAD_KEY_PROPERTY,
  UPLOAD_KEY_PROPERTIES,
} from './with-android-upload-signing';

const BUILD_GRADLE = [
  'android {',
  '    buildTypes {',
  '        release {',
  '            signingConfig signingConfigs.debug',
  '        }',
  '    }',
  '}',
  '',
].join('\n');

describe('release signing', () => {
  it('comes after the android block, so that it overrides the debug signing', () => {
    const gradle = addReleaseSigning(BUILD_GRADLE);

    expect(gradle.startsWith(BUILD_GRADLE.trimEnd())).toBe(true);
    expect(gradle.lastIndexOf('signingConfig flustUploadKey')).toBeGreaterThan(
      gradle.indexOf('signingConfig signingConfigs.debug'),
    );
  });

  it('is added once when the prebuild runs again', () => {
    const once = addReleaseSigning(BUILD_GRADLE);

    expect(addReleaseSigning(once)).toBe(once);
  });

  it('reads every upload key property from Gradle, not from a file of the repository', () => {
    const gradle = addReleaseSigning(BUILD_GRADLE);

    for (const name of UPLOAD_KEY_PROPERTIES) {
      expect(gradle).toContain(`findProperty('${name}')`);
    }
    expect(gradle).toContain(`findProperty('${REQUIRE_UPLOAD_KEY_PROPERTY}')`);
    expect(gradle).not.toMatch(/\.properties['"]/);
  });

  it('keeps the symbol tables of the native libraries for Play', () => {
    expect(addReleaseSigning(BUILD_GRADLE)).toContain("debugSymbolLevel 'SYMBOL_TABLE'");
  });
});

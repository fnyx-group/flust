import fs from 'node:fs';
import path from 'node:path';

import { addReleaseSigning } from './with-android-upload-signing';

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

const signingScript = fs.readFileSync(
  path.join(__dirname, 'android-upload-signing.gradle'),
  'utf8',
);
const buildScript = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'build-android-bundle.sh'),
  'utf8',
);

// The upload key properties, as the Gradle script lists them.
function uploadKeyProperties(): string[] {
  const list = /def uploadKeyProperties = \[([^\]]*)\]/.exec(signingScript)?.[1] ?? '';
  return [...list.matchAll(/'([A-Za-z]+)'/g)].map((match) => match[1] ?? '');
}

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

  it('leaves the choice of key to the Gradle script that plugins/jvm-test runs', () => {
    const gradle = addReleaseSigning(BUILD_GRADLE);

    expect(gradle).toContain(
      "apply from: new File(rootDir, '../plugins/android-upload-signing.gradle')",
    );
    expect(gradle).toContain('def flustUploadKey = flustUploadKeyFrom { findProperty(it) }');
  });

  it('signs with each property of the upload key', () => {
    const gradle = addReleaseSigning(BUILD_GRADLE);

    expect(uploadKeyProperties()).toHaveLength(4);
    for (const name of uploadKeyProperties()) {
      expect(gradle).toContain(`flustUploadKey.${name}`);
    }
  });

  it('gets every property of the upload key from the --upload build, through its environment', () => {
    for (const name of uploadKeyProperties()) {
      expect(buildScript).toContain(`ORG_GRADLE_PROJECT_${name}=`);
    }
    expect(buildScript).toContain('-PflustRequireUploadKey=true');
  });

  it('keeps the symbol tables of the native libraries for Play', () => {
    expect(addReleaseSigning(BUILD_GRADLE)).toContain("debugSymbolLevel 'SYMBOL_TABLE'");
  });
});

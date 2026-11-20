import { DEVELOPMENT_MODULES, excludeModules } from './with-production-modules';

const SETTINGS = [
  'plugins {',
  '  id("expo-autolinking-settings")',
  '}',
  'expoAutolinking.useExpoModules()',
  "include ':app'",
  '',
].join('\n');

describe('production modules', () => {
  it('excludes the modules before Expo modules are linked', () => {
    const settings = excludeModules(SETTINGS, ['expo-dev-client', '@expo/dom-webview']);
    expect(settings).toContain(
      "expoAutolinking.exclude = ['expo-dev-client', '@expo/dom-webview']\nexpoAutolinking.useExpoModules()",
    );
  });

  it('leaves out the development client and the DOM web view', () => {
    expect(DEVELOPMENT_MODULES).toEqual(
      expect.arrayContaining([
        'expo-dev-client',
        'expo-dev-launcher',
        'expo-dev-menu',
        '@expo/dom-webview',
      ]),
    );
  });

  it('fails when Expo modules are not linked once', () => {
    expect(() => excludeModules("include ':app'", DEVELOPMENT_MODULES)).toThrow('once');
    expect(() => excludeModules(SETTINGS + SETTINGS, DEVELOPMENT_MODULES)).toThrow('once');
  });
});

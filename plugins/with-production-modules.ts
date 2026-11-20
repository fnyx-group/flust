import { withSettingsGradle, type ConfigPlugin } from 'expo/config-plugins';

// Modules the development build needs and the production app never uses: the development client
// and the modules only it depends on, and the web view of DOM components, which flust has none of. Linked, they ship their classes
// and their licenses in the APK even when nothing loads them. The exclusions of package.json
// apply to every variant, so these ones are added to the production settings.gradle only.
// See docs/decisions/0044-production-modules.md.
export const DEVELOPMENT_MODULES = [
  'expo-dev-client',
  'expo-dev-launcher',
  'expo-dev-menu',
  'expo-dev-menu-interface',
  'expo-manifests',
  'expo-json-utils',
  'expo-updates-interface',
  '@expo/dom-webview',
];

const USE_EXPO_MODULES = 'expoAutolinking.useExpoModules()';

export function excludeModules(settings: string, modules: readonly string[]): string {
  const at = settings.indexOf(USE_EXPO_MODULES);
  if (at === -1 || at !== settings.lastIndexOf(USE_EXPO_MODULES)) {
    throw new Error(`settings.gradle must call ${USE_EXPO_MODULES} once.`);
  }
  const list = modules.map((name) => `'${name}'`).join(', ');
  return `${settings.slice(0, at)}expoAutolinking.exclude = [${list}]\n${settings.slice(at)}`;
}

export const withProductionModules: ConfigPlugin = (config) =>
  withSettingsGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      throw new Error('settings.gradle is expected in Groovy.');
    }
    mod.modResults.contents = excludeModules(mod.modResults.contents, DEVELOPMENT_MODULES);
    return mod;
  });

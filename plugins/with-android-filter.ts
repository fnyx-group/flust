import {
  AndroidConfig,
  withAndroidManifest,
  withGradleProperties,
  type ConfigPlugin,
} from 'expo/config-plugins';

// The Android content filter of modules/flust-filter. Its VPN service and boot receiver are
// declared here rather than in the module's manifest, so that only the builds that ship the
// filter carry them, with the compiled lists. scripts/check-android-release.sh fails on a build
// that has the service without INTERNET, or INTERNET without the service, or any other VPN
// service. See docs/decisions/0033-android-filter-network-access.md.
export const FILTER_VPN_SERVICE = 'org.fnyxgroup.flust.filter.FilterVpnService';
export const FILTER_BOOT_RECEIVER = 'org.fnyxgroup.flust.filter.FilterBootReceiver';
export const FILTER_LISTS_PROPERTY = 'flust.filterLists';

type Manifest = AndroidConfig.Manifest.AndroidManifest;
type Application = AndroidConfig.Manifest.ManifestApplication;

function withoutComponent<T extends { $: { 'android:name': string } }>(
  components: T[] | undefined,
  name: string,
) {
  return (components ?? []).filter((component) => component.$['android:name'] !== name);
}

export function addFilterComponents(manifest: Manifest): Manifest {
  const application: Application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  application.service = [
    ...withoutComponent(application.service, FILTER_VPN_SERVICE),
    {
      $: {
        'android:name': FILTER_VPN_SERVICE,
        'android:permission': 'android.permission.BIND_VPN_SERVICE',
        'android:exported': 'false',
      },
      'intent-filter': [{ action: [{ $: { 'android:name': 'android.net.VpnService' } }] }],
    },
  ];
  application.receiver = [
    ...withoutComponent(application.receiver, FILTER_BOOT_RECEIVER),
    {
      $: { 'android:name': FILTER_BOOT_RECEIVER, 'android:exported': 'false' },
      'intent-filter': [
        {
          action: [
            { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
            { $: { 'android:name': 'android.intent.action.MY_PACKAGE_REPLACED' } },
          ],
        },
      ],
    },
  ];
  return manifest;
}

export function setFilterLists(
  properties: AndroidConfig.Properties.PropertiesItem[],
): AndroidConfig.Properties.PropertiesItem[] {
  return [
    ...properties.filter(
      (item) => !(item.type === 'property' && item.key === FILTER_LISTS_PROPERTY),
    ),
    { type: 'property', key: FILTER_LISTS_PROPERTY, value: 'true' },
  ];
}

export const withAndroidFilter: ConfigPlugin<boolean> = (config, on) => {
  if (!on) return config;
  const withComponents = withAndroidManifest(config, (mod) => {
    mod.modResults = addFilterComponents(mod.modResults);
    return mod;
  });
  return withGradleProperties(withComponents, (mod) => {
    mod.modResults = setFilterLists(mod.modResults);
    return mod;
  });
};

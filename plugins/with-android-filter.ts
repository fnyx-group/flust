import {
  AndroidConfig,
  withAndroidManifest,
  withGradleProperties,
  type ConfigPlugin,
} from 'expo/config-plugins';

// The Android content filter of modules/flust-filter: its VPN service, its boot receiver, the two
// permissions it needs and the compiled lists. scripts/check-android-release.sh fails on a build
// without the service or one of the permissions, or with any other VPN service. See
// docs/decisions/0033-android-filter-network-access.md and
// docs/decisions/0041-filter-network-permissions.md.
export const FILTER_VPN_SERVICE = 'org.fnyxgroup.flust.filter.FilterVpnService';
export const FILTER_BOOT_RECEIVER = 'org.fnyxgroup.flust.filter.FilterBootReceiver';
export const FILTER_LISTS_PROPERTY = 'flust.filterLists';

// INTERNET reaches the resolver; ACCESS_NETWORK_STATE reads strict Private DNS and another VPN.
export const FILTER_PERMISSIONS = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
];

type Manifest = AndroidConfig.Manifest.AndroidManifest;
type Application = AndroidConfig.Manifest.ManifestApplication;

function withoutComponent<T extends { $: { 'android:name': string } }>(
  components: T[] | undefined,
  name: string,
) {
  return (components ?? []).filter((component) => component.$['android:name'] !== name);
}

export function addFilterComponents(manifest: Manifest): Manifest {
  AndroidConfig.Permissions.ensurePermissions(manifest, FILTER_PERMISSIONS);
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

export const withAndroidFilter: ConfigPlugin = (config) => {
  const withComponents = withAndroidManifest(config, (mod) => {
    mod.modResults = addFilterComponents(mod.modResults);
    return mod;
  });
  return withGradleProperties(withComponents, (mod) => {
    mod.modResults = setFilterLists(mod.modResults);
    return mod;
  });
};

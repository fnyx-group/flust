import {
  addFilterComponents,
  FILTER_BOOT_RECEIVER,
  FILTER_LISTS_PROPERTY,
  FILTER_LOGS_META_DATA,
  FILTER_PERMISSIONS,
  FILTER_RESTART_JOB,
  FILTER_VPN_SERVICE,
  setFilterLists,
} from './with-android-filter';

function manifest() {
  return {
    manifest: {
      $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
      queries: [],
      application: [{ $: { 'android:name': '.MainApplication' } }],
    },
  };
}

describe('the Android filter plugin', () => {
  it('declares the foreground VPN service and the restart job, which only the system may bind', () => {
    const application = addFilterComponents(manifest(), false).manifest.application?.[0];

    expect(application?.service).toEqual([
      {
        $: {
          'android:name': FILTER_VPN_SERVICE,
          'android:permission': 'android.permission.BIND_VPN_SERVICE',
          'android:exported': 'false',
          'android:foregroundServiceType': 'systemExempted',
        },
        'intent-filter': [{ action: [{ $: { 'android:name': 'android.net.VpnService' } }] }],
      },
      {
        $: {
          'android:name': FILTER_RESTART_JOB,
          'android:permission': 'android.permission.BIND_JOB_SERVICE',
          'android:exported': 'false',
        },
      },
    ]);
  });

  it('declares the receiver that restarts the filter, not exported', () => {
    const receiver = addFilterComponents(manifest(), false).manifest.application?.[0]
      ?.receiver?.[0];

    expect(receiver?.$).toEqual({
      'android:name': FILTER_BOOT_RECEIVER,
      'android:exported': 'false',
    });
    expect(
      receiver?.['intent-filter']?.[0]?.action?.map((action) => action.$['android:name']),
    ).toEqual([
      'android.intent.action.BOOT_COMPLETED',
      'android.intent.action.MY_PACKAGE_REPLACED',
    ]);
  });

  it('requests the network and foreground service permissions', () => {
    const permissions = addFilterComponents(manifest(), false).manifest['uses-permission'];

    expect(permissions?.map((permission) => permission.$['android:name'])).toEqual([
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_SYSTEM_EXEMPTED',
    ]);
  });

  it('declares each component and permission once when it runs again', () => {
    const twice = addFilterComponents(addFilterComponents(manifest(), false), false).manifest;
    const application = twice.application?.[0];

    expect(application?.service).toHaveLength(2);
    expect(application?.receiver).toHaveLength(1);
    expect(application?.['meta-data']).toHaveLength(1);
    expect(twice['uses-permission']).toHaveLength(FILTER_PERMISSIONS.length);
  });

  it.each([true, false])('tells the module whether to log why the tunnel stopped (%s)', (logs) => {
    const application = addFilterComponents(manifest(), logs).manifest.application?.[0];

    expect(application?.['meta-data']).toEqual([
      { $: { 'android:name': FILTER_LOGS_META_DATA, 'android:value': String(logs) } },
    ]);
  });

  it('asks the module to compile the lists', () => {
    const properties = setFilterLists([
      { type: 'property', key: FILTER_LISTS_PROPERTY, value: 'false' },
      { type: 'property', key: 'other', value: '1' },
    ]);

    expect(properties).toEqual([
      { type: 'property', key: 'other', value: '1' },
      { type: 'property', key: FILTER_LISTS_PROPERTY, value: 'true' },
    ]);
  });
});

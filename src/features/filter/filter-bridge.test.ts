import { createFilterBridge, type NativeFilter } from './filter-bridge';

const SETTINGS = { youtubeStrict: false };

function native(overrides: Partial<NativeFilter> = {}): NativeFilter {
  return {
    getStatus: () => ({
      available: true,
      consent: true,
      running: true,
      enabled: true,
      stopReason: null,
      youtubeStrict: true,
      strictPrivateDns: true,
      otherVpn: false,
    }),
    requestConsent: async () => true,
    start: async () => true,
    stop: async () => undefined,
    resume: async () => true,
    measure: async () => ({ entries: 304114, bytes: 2737038, loadMillis: 41.5, decideMicros: 6.2 }),
    ...overrides,
  };
}

describe('the filter bridge', () => {
  it('reports the filter as unavailable without the native module, as on iOS', async () => {
    const bridge = createFilterBridge(null);

    expect(bridge.status()).toEqual({ available: false });
    await expect(bridge.requestConsent()).resolves.toBe(false);
    await expect(bridge.start(SETTINGS)).resolves.toBe(false);
    await expect(bridge.resume()).resolves.toBe(false);
    await expect(bridge.measure()).resolves.toBeNull();
    await expect(bridge.stop()).resolves.toBeUndefined();
  });

  it('reads the status, the setting and what it sees of the networks', () => {
    expect(createFilterBridge(native()).status()).toEqual({
      available: true,
      consent: true,
      running: true,
      enabled: true,
      youtubeStrict: true,
      stopReason: null,
      strictPrivateDns: true,
      otherVpn: false,
    });
  });

  it('reports a build without the VPN service as unavailable', () => {
    const bridge = createFilterBridge(native({ getStatus: () => ({ available: false }) }));

    expect(bridge.status()).toEqual({ available: false });
  });

  it('falls back to the defaults and to no reason for values it does not know', () => {
    const status = createFilterBridge(
      native({
        getStatus: () => ({
          available: true,
          stopReason: 'exploded',
          youtubeStrict: 'yes',
          otherVpn: 1,
        }),
      }),
    ).status();

    expect(status).toEqual({
      available: true,
      consent: false,
      running: false,
      enabled: false,
      youtubeStrict: false,
      stopReason: null,
      strictPrivateDns: false,
      otherVpn: false,
    });
  });

  it.each(['revoked', 'no-consent', 'failed', 'stopped', 'lists', 'boot-deferred'] as const)(
    'keeps the stop reason %s',
    (reason) => {
      const status = createFilterBridge(
        native({ getStatus: () => ({ available: true, stopReason: reason }) }),
      ).status();

      expect(status).toMatchObject({ stopReason: reason });
    },
  );

  it('reads a status that throws as unavailable', () => {
    const bridge = createFilterBridge(
      native({
        getStatus: () => {
          throw new Error('context lost');
        },
      }),
    );

    expect(bridge.status()).toEqual({ available: false });
  });

  it('passes the settings to the module when the filter starts', async () => {
    const start = jest.fn(async () => true);
    const settings = { youtubeStrict: true };

    await expect(createFilterBridge(native({ start })).start(settings)).resolves.toBe(true);
    expect(start).toHaveBeenCalledWith(settings);
  });

  it('turns a rejected call into a failed result', async () => {
    const bridge = createFilterBridge(
      native({
        requestConsent: async () => {
          throw new Error('no activity');
        },
        start: async () => 'yes',
        measure: async () => ({ entries: 1 }),
      }),
    );

    await expect(bridge.requestConsent()).resolves.toBe(false);
    await expect(bridge.start(SETTINGS)).resolves.toBe(false);
    await expect(bridge.measure()).resolves.toBeNull();
  });

  it('reads the measurements, without a start or a resolver when the tunnel has not started yet', async () => {
    await expect(createFilterBridge(native()).measure()).resolves.toEqual({
      entries: 304114,
      bytes: 2737038,
      loadMillis: 41.5,
      decideMicros: 6.2,
      start: null,
      resolver: null,
    });
  });

  it.each(['Quad9', 'DNS4EU', 'Cloudflare'])(
    'reads %s as the resolver in use',
    async (resolver) => {
      const bridge = createFilterBridge(
        native({
          measure: async () => ({
            entries: 304114,
            bytes: 2737038,
            loadMillis: 41.5,
            decideMicros: 6.2,
            resolver,
          }),
        }),
      );

      await expect(bridge.measure()).resolves.toMatchObject({ resolver });
    },
  );

  it('ignores a resolver it does not know', async () => {
    const bridge = createFilterBridge(
      native({
        measure: async () => ({
          entries: 304114,
          bytes: 2737038,
          loadMillis: 41.5,
          decideMicros: 6.2,
          resolver: 'dns.example',
        }),
      }),
    );

    await expect(bridge.measure()).resolves.toMatchObject({ entries: 304114, resolver: null });
  });

  it('reads the phases of the last tunnel start', async () => {
    const start = {
      listsMillis: 38.2,
      listsCached: false,
      trustMillis: 120.4,
      establishMillis: 9.1,
      totalMillis: 171.3,
    };
    const bridge = createFilterBridge(
      native({
        measure: async () => ({
          entries: 304114,
          bytes: 2737038,
          loadMillis: 41.5,
          decideMicros: 6.2,
          start,
        }),
      }),
    );

    await expect(bridge.measure()).resolves.toMatchObject({ start });
  });

  it('ignores a start it cannot read, and keeps the measure of the lists', async () => {
    const bridge = createFilterBridge(
      native({
        measure: async () => ({
          entries: 304114,
          bytes: 2737038,
          loadMillis: 41.5,
          decideMicros: 6.2,
          start: { listsMillis: 'slow', listsCached: true },
        }),
      }),
    );

    await expect(bridge.measure()).resolves.toMatchObject({ entries: 304114, start: null });
  });
});

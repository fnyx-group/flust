import { createFilterBridge, DEFAULT_FILTER_SETTINGS, type NativeFilter } from './filter-bridge';

function native(overrides: Partial<NativeFilter> = {}): NativeFilter {
  return {
    getStatus: () => ({
      available: true,
      consent: true,
      running: true,
      enabled: true,
      stopReason: null,
      adult: true,
      aiNudify: false,
      aiCompanions: true,
      strict: true,
      youtubeStrict: true,
      exceptions: ['example.org'],
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
    await expect(bridge.start(DEFAULT_FILTER_SETTINGS)).resolves.toBe(false);
    await expect(bridge.resume()).resolves.toBe(false);
    await expect(bridge.measure()).resolves.toBeNull();
    await expect(bridge.stop()).resolves.toBeUndefined();
  });

  it('reads the status and the settings', () => {
    expect(createFilterBridge(native()).status()).toEqual({
      available: true,
      consent: true,
      running: true,
      enabled: true,
      stopReason: null,
      settings: {
        adult: true,
        aiNudify: false,
        aiCompanions: true,
        strict: true,
        youtubeStrict: true,
        exceptions: ['example.org'],
      },
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
          adult: 'yes',
          exceptions: [1, 'a.example'],
        }),
      }),
    ).status();

    expect(status).toEqual({
      available: true,
      consent: false,
      running: false,
      enabled: false,
      stopReason: null,
      settings: { ...DEFAULT_FILTER_SETTINGS, exceptions: ['a.example'] },
    });
  });

  it.each(['revoked', 'no-consent', 'failed', 'stopped'] as const)(
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
    const settings = { ...DEFAULT_FILTER_SETTINGS, aiCompanions: true };

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
    await expect(bridge.start(DEFAULT_FILTER_SETTINGS)).resolves.toBe(false);
    await expect(bridge.measure()).resolves.toBeNull();
  });

  it('reads the measurements', async () => {
    await expect(createFilterBridge(native()).measure()).resolves.toEqual({
      entries: 304114,
      bytes: 2737038,
      loadMillis: 41.5,
      decideMicros: 6.2,
    });
  });
});

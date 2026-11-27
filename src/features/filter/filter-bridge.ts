// The Android content filter of modules/flust-filter, seen from the app. Every native value is
// checked before use: a module that is missing, as on iOS and the web, or that answers something
// unexpected, reads as an unavailable filter rather than a crash.

import {
  FILTER_STOP_REASONS,
  type FilterStatus,
  type FilterStopReason,
} from '@/domain/filter-state';

// The one setting the app passes: everything else is fixed while the filter runs
// (docs/decisions/0038-content-filter.md).
export type FilterSettings = { youtubeStrict: boolean };

// The words of the notification Android shows while the filter runs, in the app's language. The
// module keeps them for the starts without the app, at boot or after a kill.
export type FilterNotificationWords = { channelName: string; text: string };

// The phases of the last tunnel start in this process: the lists and the certificates off the
// main thread, then establishing the tunnel on it.
export type TunnelStartMeasure = {
  listsMillis: number;
  listsCached: boolean;
  trustMillis: number;
  establishMillis: number;
  totalMillis: number;
};

const RESOLVERS = ['Quad9', 'Cloudflare', 'DNS4EU'] as const;

export type Resolver = (typeof RESOLVERS)[number];

export type FilterMeasure = {
  entries: number;
  bytes: number;
  loadMillis: number;
  decideMicros: number;
  start: TunnelStartMeasure | null;
  // The resolver queries go to, or null when none answers or the tunnel is down.
  resolver: Resolver | null;
};

export type NativeFilter = {
  getStatus(): unknown;
  requestConsent(): Promise<unknown>;
  start(settings: FilterSettings & { notification?: FilterNotificationWords }): Promise<unknown>;
  stop(): Promise<unknown>;
  resume(): Promise<unknown>;
  describe(words: FilterNotificationWords): Promise<unknown>;
  measure(): Promise<unknown>;
  openUnusedAppSettings(): Promise<unknown>;
};

export type FilterBridge = {
  status(): FilterStatus;
  requestConsent(): Promise<boolean>;
  start(settings: FilterSettings): Promise<boolean>;
  // False when the filter could not be turned off, for example when its settings cannot be read:
  // it then stays on.
  stop(): Promise<boolean>;
  resume(): Promise<boolean>;
  describe(): Promise<void>;
  measure(): Promise<FilterMeasure | null>;
  openUnusedAppSettings(): Promise<boolean>;
};

type Fields = Record<string, unknown>;

function isFields(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null;
}

function flag(fields: Fields, key: string, fallback: boolean): boolean {
  const value = fields[key];
  return typeof value === 'boolean' ? value : fallback;
}

function optionalFlag(fields: Fields, key: string): boolean | null {
  const value = fields[key];
  return typeof value === 'boolean' ? value : null;
}

function readStopReason(value: unknown): FilterStopReason | null {
  return FILTER_STOP_REASONS.find((reason) => reason === value) ?? null;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function readStart(value: unknown): TunnelStartMeasure | null {
  if (!isFields(value)) return null;
  const { listsMillis, listsCached, trustMillis, establishMillis, totalMillis } = value;
  if (
    !isNumber(listsMillis) ||
    !isNumber(trustMillis) ||
    !isNumber(establishMillis) ||
    !isNumber(totalMillis) ||
    typeof listsCached !== 'boolean'
  ) {
    return null;
  }
  return { listsMillis, listsCached, trustMillis, establishMillis, totalMillis };
}

function readMeasure(value: unknown): FilterMeasure | null {
  if (!isFields(value)) return null;
  const { entries, bytes, loadMillis, decideMicros } = value;
  if (!isNumber(entries) || !isNumber(bytes) || !isNumber(loadMillis) || !isNumber(decideMicros)) {
    return null;
  }
  return {
    entries,
    bytes,
    loadMillis,
    decideMicros,
    start: readStart(value.start),
    resolver: readResolver(value.resolver),
  };
}

function readResolver(value: unknown): Resolver | null {
  return RESOLVERS.find((resolver) => resolver === value) ?? null;
}

async function settle<T>(call: () => Promise<unknown>, read: (value: unknown) => T, failed: T) {
  try {
    return read(await call());
  } catch {
    return failed;
  }
}

// `words` is read at each call, so that a change of language reaches the next start.
export function createFilterBridge(
  native: NativeFilter | null,
  words: () => FilterNotificationWords | null = () => null,
): FilterBridge {
  return {
    status() {
      if (native === null) return { available: false };
      let fields: unknown;
      try {
        fields = native.getStatus();
      } catch {
        return { available: false };
      }
      if (!isFields(fields) || fields.available !== true) return { available: false };
      return {
        available: true,
        consent: flag(fields, 'consent', false),
        running: flag(fields, 'running', false),
        enabled: flag(fields, 'enabled', false),
        youtubeStrict: flag(fields, 'youtubeStrict', false),
        stopReason: readStopReason(fields.stopReason),
        strictPrivateDns: flag(fields, 'strictPrivateDns', false),
        otherVpn: flag(fields, 'otherVpn', false),
        alwaysOn: optionalFlag(fields, 'alwaysOn'),
        pausedIfUnused: optionalFlag(fields, 'pausedIfUnused'),
      };
    },
    requestConsent: () =>
      native === null
        ? Promise.resolve(false)
        : settle(
            () => native.requestConsent(),
            (value) => value === true,
            false,
          ),
    start: (settings) =>
      native === null
        ? Promise.resolve(false)
        : settle(
            () => {
              const notification = words();
              return native.start(notification === null ? settings : { ...settings, notification });
            },
            (value) => value === true,
            false,
          ),
    stop: () =>
      native === null
        ? Promise.resolve(false)
        : settle(
            () => native.stop(),
            () => true,
            false,
          ),
    resume: () =>
      native === null
        ? Promise.resolve(false)
        : settle(
            () => native.resume(),
            (value) => value === true,
            false,
          ),
    describe: () => {
      const notification = words();
      if (native === null || notification === null) return Promise.resolve();
      return settle(
        () => native.describe(notification),
        () => undefined,
        undefined,
      );
    },
    measure: () =>
      native === null ? Promise.resolve(null) : settle(() => native.measure(), readMeasure, null),
    openUnusedAppSettings: () =>
      native === null
        ? Promise.resolve(false)
        : settle(
            () => native.openUnusedAppSettings(),
            (value) => value === true,
            false,
          ),
  };
}

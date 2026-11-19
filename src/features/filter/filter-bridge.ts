// The Android content filter of modules/flust-filter, seen from the app. Every native value is
// checked before use: a module that is missing, as on iOS and the web, or that answers something
// unexpected, reads as an unavailable filter rather than a crash.

export type FilterSettings = {
  adult: boolean;
  aiNudify: boolean;
  aiCompanions: boolean;
  strict: boolean;
  youtubeStrict: boolean;
  exceptions: string[];
};

export const DEFAULT_FILTER_SETTINGS: FilterSettings = {
  adult: true,
  aiNudify: true,
  aiCompanions: false,
  strict: true,
  youtubeStrict: false,
  exceptions: [],
};

const STOP_REASONS = ['stopped', 'revoked', 'no-consent', 'failed'] as const;
export type FilterStopReason = (typeof STOP_REASONS)[number];

export type FilterStatus =
  | { available: false }
  | {
      available: true;
      consent: boolean;
      running: boolean;
      enabled: boolean;
      stopReason: FilterStopReason | null;
      settings: FilterSettings;
    };

export type FilterMeasure = {
  entries: number;
  bytes: number;
  loadMillis: number;
  decideMicros: number;
};

export type NativeFilter = {
  getStatus(): unknown;
  requestConsent(): Promise<unknown>;
  start(settings: FilterSettings): Promise<unknown>;
  stop(): Promise<unknown>;
  resume(): Promise<unknown>;
  measure(): Promise<unknown>;
};

export type FilterBridge = {
  status(): FilterStatus;
  requestConsent(): Promise<boolean>;
  start(settings: FilterSettings): Promise<boolean>;
  stop(): Promise<void>;
  resume(): Promise<boolean>;
  measure(): Promise<FilterMeasure | null>;
};

type Fields = Record<string, unknown>;

function isFields(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null;
}

function flag(fields: Fields, key: string, fallback: boolean): boolean {
  const value = fields[key];
  return typeof value === 'boolean' ? value : fallback;
}

function readSettings(fields: Fields): FilterSettings {
  const exceptions = fields.exceptions;
  return {
    adult: flag(fields, 'adult', DEFAULT_FILTER_SETTINGS.adult),
    aiNudify: flag(fields, 'aiNudify', DEFAULT_FILTER_SETTINGS.aiNudify),
    aiCompanions: flag(fields, 'aiCompanions', DEFAULT_FILTER_SETTINGS.aiCompanions),
    strict: flag(fields, 'strict', DEFAULT_FILTER_SETTINGS.strict),
    youtubeStrict: flag(fields, 'youtubeStrict', DEFAULT_FILTER_SETTINGS.youtubeStrict),
    exceptions: Array.isArray(exceptions)
      ? exceptions.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

function readStopReason(value: unknown): FilterStopReason | null {
  return STOP_REASONS.find((reason) => reason === value) ?? null;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function readMeasure(value: unknown): FilterMeasure | null {
  if (!isFields(value)) return null;
  const { entries, bytes, loadMillis, decideMicros } = value;
  if (!isNumber(entries) || !isNumber(bytes) || !isNumber(loadMillis) || !isNumber(decideMicros)) {
    return null;
  }
  return { entries, bytes, loadMillis, decideMicros };
}

async function settle<T>(call: () => Promise<unknown>, read: (value: unknown) => T, failed: T) {
  try {
    return read(await call());
  } catch {
    return failed;
  }
}

export function createFilterBridge(native: NativeFilter | null): FilterBridge {
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
        stopReason: readStopReason(fields.stopReason),
        settings: readSettings(fields),
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
            () => native.start(settings),
            (value) => value === true,
            false,
          ),
    stop: () =>
      native === null
        ? Promise.resolve()
        : settle(
            () => native.stop(),
            () => undefined,
            undefined,
          ),
    resume: () =>
      native === null
        ? Promise.resolve(false)
        : settle(
            () => native.resume(),
            (value) => value === true,
            false,
          ),
    measure: () =>
      native === null ? Promise.resolve(null) : settle(() => native.measure(), readMeasure, null),
  };
}

import type { ErrorLog } from '@/data/error-log-store';
import { toEntry, type ErrorKind } from '@/domain/error-log';

export type ErrorContext = {
  kind: ErrorKind;
  route?: string | null;
  code?: string | null;
};

export type RecordError = (error: unknown, context: ErrorContext) => Promise<void>;

// Recording runs while something already went wrong, so it never throws and never rejects.
export function createErrorRecorder(log: Pick<ErrorLog, 'record'>, now: () => number): RecordError {
  return async (error, context) => {
    try {
      await log.record(toEntry({ ...context, error, at: now() }));
    } catch {
      // Nothing more can be done about an error that cannot be recorded.
    }
  };
}

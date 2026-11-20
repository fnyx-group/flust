import type { Database } from '@/data/database';
import { decodeFilterRequest, encodeFilterRequest } from '@/data/filter-request-codec';
import { readSetting, SETTING_KEYS, writeSetting } from '@/data/setting-store';
import { attempt, type StorageError } from '@/data/storage-error';
import { resumeRequest, type ClockReading, type FilterRequest } from '@/domain/filter-request';
import { ok, type Result } from '@/domain/result';

export type FilterStorageError = StorageError;

// The pending request to weaken the filter (docs/decisions/0040-filter-delay.md). The filter's own
// settings live outside the database, in the module, so it can start at boot.
export type FilterRepository = {
  // The request as it stands `now`, with the time since it was saved taken off.
  loadRequest(now: ClockReading): Promise<Result<FilterRequest | null, FilterStorageError>>;
  saveRequest(request: FilterRequest, now: ClockReading): Promise<Result<void, FilterStorageError>>;
  clearRequest(): Promise<Result<void, FilterStorageError>>;
};

export function createFilterRepository(db: Database): FilterRepository {
  return {
    loadRequest: (now) =>
      attempt(async () => {
        const saved = decodeFilterRequest(await readSetting(db, SETTING_KEYS.filterRequest));
        return ok(saved === null ? null : resumeRequest(saved, now));
      }),
    saveRequest: (request, now) =>
      attempt(async () => {
        const value = encodeFilterRequest({ request, at: now });
        await db.transaction((tx) => writeSetting(tx, SETTING_KEYS.filterRequest, value));
        return ok(undefined);
      }),
    clearRequest: () =>
      attempt(async () => {
        await db.transaction((tx) =>
          tx.run('DELETE FROM setting WHERE key = ?', [SETTING_KEYS.filterRequest]),
        );
        return ok(undefined);
      }),
  };
}

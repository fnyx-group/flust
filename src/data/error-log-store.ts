import { decodeLog, encodeLog } from '@/data/error-log-codec';
import {
  createKey,
  readKey,
  type KeyStore,
  type RandomBytes,
  type StorageKey,
} from '@/data/storage-key';
import { appendEntries, type ErrorEntry } from '@/domain/error-log';
import { err, ok, type Result } from '@/domain/result';

// AES-GCM in the app, with a key given as 64 hex characters. `open` throws when the data was
// sealed with another key or was changed.
export type SealedBox = {
  seal(plain: Uint8Array, key: StorageKey): Promise<Uint8Array>;
  open(sealed: Uint8Array, key: StorageKey): Promise<Uint8Array>;
};

// `write` replaces the whole file at once, so a write cut short leaves the previous file.
export type BinaryFile = {
  read(): Promise<Uint8Array | null>;
  write(bytes: Uint8Array): Promise<void>;
  remove(): Promise<void>;
};

export type ErrorLogDeps = {
  keyStore: KeyStore;
  randomBytes: RandomBytes;
  box: SealedBox;
  file: BinaryFile;
};

export type ClearErrorLogError = 'clear-failed';

export type ErrorLog = {
  record(entry: ErrorEntry): Promise<void>;
  entries(): Promise<readonly ErrorEntry[]>;
  clear(): Promise<Result<void, ClearErrorLogError>>;
};

// The log lives outside the database, with its own key, so it can still be read in safe mode
// when the database cannot. Entries are kept in memory too: while the keystore is not readable,
// such as before the first unlock, they are only in memory and are written once it is.
// Operations run one at a time, so two records never write over each other.
export function createErrorLog(deps: ErrorLogDeps): ErrorLog {
  let entries: ErrorEntry[] = [];
  let key: StorageKey | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  }

  async function load(): Promise<StorageKey | null> {
    if (key !== null) return key;
    const stored = await readKey(deps.keyStore);
    if (!stored.ok) return null;
    if (stored.value === null) {
      // A file sealed with a lost key can never be read: it is replaced on the next write.
      const created = await createKey(deps.keyStore, deps.randomBytes);
      if (!created.ok) return null;
      key = created.value;
      return key;
    }
    entries = appendEntries(await readStored(stored.value), entries);
    key = stored.value;
    return key;
  }

  async function readStored(storedKey: StorageKey): Promise<ErrorEntry[]> {
    try {
      const sealed = await deps.file.read();
      return sealed === null ? [] : decodeLog(await deps.box.open(sealed, storedKey));
    } catch {
      return [];
    }
  }

  return {
    record: (entry) =>
      enqueue(async () => {
        entries = appendEntries(entries, [entry]);
        try {
          const current = await load();
          if (current !== null) {
            await deps.file.write(await deps.box.seal(encodeLog(entries), current));
          }
        } catch {
          // The entry stays in memory; recording an error must never raise another one.
        }
      }),
    entries: () =>
      enqueue(async () => {
        await load().catch(() => null);
        return entries;
      }),
    clear: () =>
      enqueue(async () => {
        entries = [];
        key = null;
        try {
          await deps.file.remove();
          await deps.keyStore.remove();
          return ok(undefined);
        } catch {
          return err('clear-failed');
        }
      }),
  };
}

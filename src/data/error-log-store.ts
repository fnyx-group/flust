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
  // Erasing everything pauses the log, so an error during the erase cannot create a new key or
  // file after the old ones are gone. Entries recorded meanwhile stay in memory only.
  pause(): () => void;
};

// The log lives outside the database, with its own key, so it can still be read in safe mode
// when the database cannot. Entries are kept in memory too: while the keystore is not readable,
// such as before the first unlock, they are only in memory and are written once it is.
// Operations run one at a time, so two records never write over each other.
export function createErrorLog(deps: ErrorLogDeps): ErrorLog {
  let entries: ErrorEntry[] = [];
  let key: StorageKey | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  let pauses = 0;

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
    const previous = await readStored(stored.value);
    // A file that could not be read this time may still hold entries: nothing is written over it
    // until a later read succeeds.
    if (previous === null) return null;
    entries = appendEntries(previous, entries);
    key = stored.value;
    return key;
  }

  // Null when the file could not be read. A file that cannot be decrypted reads as empty: it can
  // never be read again, so the next write replaces it.
  async function readStored(storedKey: StorageKey): Promise<ErrorEntry[] | null> {
    let sealed: Uint8Array | null;
    try {
      sealed = await deps.file.read();
    } catch {
      return null;
    }
    if (sealed === null) return [];
    try {
      return decodeLog(await deps.box.open(sealed, storedKey));
    } catch {
      return [];
    }
  }

  return {
    record: (entry) =>
      enqueue(async () => {
        entries = appendEntries(entries, [entry]);
        if (pauses > 0) return;
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
        if (pauses === 0) await load().catch(() => null);
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
    pause: () => {
      pauses += 1;
      let resumed = false;
      return () => {
        if (resumed) return;
        resumed = true;
        pauses -= 1;
      };
    },
  };
}

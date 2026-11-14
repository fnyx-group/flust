import type { Connection } from '@/data/database';
import type { KeyStore, RandomBytes, StorageKey } from '@/data/storage-key';

// Opening a file that does not exist creates it, keyed with the given key.
export type DatabaseDriver = {
  open(name: string, key: StorageKey): Promise<Connection>;
};

// File operations on databases, by name, in the driver's database directory. `remove` also
// deletes the journal files SQLite keeps next to a database, and does nothing if none exist.
export type DatabaseFiles = {
  exists(name: string): Promise<boolean>;
  copy(from: string, to: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  remove(name: string): Promise<void>;
};

export type StorageDeps = {
  keyStore: KeyStore;
  randomBytes: RandomBytes;
  driver: DatabaseDriver;
  files: DatabaseFiles;
};

export const DATABASE_NAME = 'flust.db';
export const BACKUP_NAME = 'flust.db.pre-migration';

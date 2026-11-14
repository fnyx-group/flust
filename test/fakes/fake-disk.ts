import { DatabaseSync } from 'node:sqlite';

import type { Connection, Row, SqlValue } from '@/data/database';
import type { DatabaseDriver, DatabaseFiles } from '@/data/storage-deps';

type StoredFile = { readonly bytes: Uint8Array; readonly key: string };

type FileOperation = keyof DatabaseFiles | 'open';

// 'garbage' replaces the whole file, 'pages' wipes a page after the header, and 'freelist' leaves
// every page readable but makes the header inconsistent, which only an integrity check notices.
type Damage = 'garbage' | 'pages' | 'freelist';

export type FakeDiskOptions = {
  // Simulates a build where the SQLCipher plugin is missing: PRAGMA cipher_version returns nothing.
  withoutCipher?: boolean;
};

export type FakeDisk = {
  files: DatabaseFiles;
  driver: DatabaseDriver;
  stored: Map<string, StoredFile>;
  openConnections(): number;
  failNext(operation: FileOperation, name?: string): void;
  damage(name: string, damage: Damage): void;
  query(name: string, sql: string): Row[];
};

// An in-memory stand-in for the database directory and SQLCipher. Each file is a serialized
// SQLite database tagged with the key it was created with; opening it with another key fails the
// way SQLCipher does, on the first read. Writes reach the "file" as soon as they are committed.
export function createFakeDisk({ withoutCipher = false }: FakeDiskOptions = {}): FakeDisk {
  const stored = new Map<string, StoredFile>();
  const failures: { operation: FileOperation; name: string | undefined }[] = [];
  let open = 0;

  function failIfPlanned(operation: FileOperation, name: string) {
    const index = failures.findIndex(
      (failure) =>
        failure.operation === operation && (failure.name === undefined || failure.name === name),
    );
    if (index === -1) return;
    failures.splice(index, 1);
    throw new Error(`Planned ${operation} failure on ${name}`);
  }

  function existing(name: string): StoredFile {
    const file = stored.get(name);
    if (!file) throw new Error(`No such file: ${name}`);
    return file;
  }

  const files: DatabaseFiles = {
    async exists(name) {
      failIfPlanned('exists', name);
      return stored.has(name);
    },
    async copy(from, to) {
      failIfPlanned('copy', from);
      stored.set(to, existing(from));
    },
    async move(from, to) {
      failIfPlanned('move', from);
      stored.set(to, existing(from));
      stored.delete(from);
    },
    async remove(name) {
      failIfPlanned('remove', name);
      stored.delete(name);
    },
  };

  const driver: DatabaseDriver = {
    async open(name, key) {
      failIfPlanned('open', name);
      const file = stored.get(name);
      const db = new DatabaseSync(':memory:');
      const readable = file === undefined || (file.key === key && deserialize(db, file.bytes));
      let seen = file?.bytes;
      // Outside a transaction, a connection sees what other connections committed to the file.
      const refresh = () => {
        const current = stored.get(name)?.bytes;
        if (!db.isTransaction && current !== undefined && current !== seen) {
          db.deserialize(current);
          seen = current;
        }
      };
      const persist = () => {
        if (db.isTransaction) return;
        seen = db.serialize();
        stored.set(name, { bytes: seen, key });
      };
      if (!file) persist();
      open += 1;
      return fakeConnection({
        db,
        readable,
        withoutCipher,
        refresh,
        persist,
        onClose: () => {
          open -= 1;
        },
      });
    },
  };

  return {
    files,
    driver,
    stored,
    openConnections: () => open,
    failNext(operation, name) {
      failures.push({ operation, name });
    },
    damage(name, damage) {
      const file = existing(name);
      stored.set(name, { key: file.key, bytes: damaged(file.bytes, damage) });
    },
    query(name, sql) {
      const db = new DatabaseSync(':memory:');
      db.deserialize(existing(name).bytes);
      const rows = db.prepare(sql).all() as Row[];
      db.close();
      return rows.map((row) => ({ ...row }));
    },
  };
}

const PAGE_SIZE = 4096;
const FREELIST_COUNT_OFFSET = 39;

function deserialize(db: DatabaseSync, bytes: Uint8Array): boolean {
  try {
    db.deserialize(bytes);
    return true;
  } catch {
    return false;
  }
}

function damaged(bytes: Uint8Array, damage: Damage): Uint8Array {
  if (damage === 'garbage') return new Uint8Array(bytes.length).fill(7);
  const copy = new Uint8Array(bytes);
  if (damage === 'pages') copy.fill(0xff, PAGE_SIZE, 2 * PAGE_SIZE);
  else copy[FREELIST_COUNT_OFFSET] = 3;
  return copy;
}

type FakeConnectionOptions = {
  db: DatabaseSync;
  readable: boolean;
  withoutCipher: boolean;
  refresh: () => void;
  persist: () => void;
  onClose: () => void;
};

function fakeConnection({
  db,
  readable,
  withoutCipher,
  refresh,
  persist,
  onClose,
}: FakeConnectionOptions): Connection {
  // PRAGMA cipher_version reads no page, so it answers even with a wrong key, as in SQLCipher.
  function cipherVersion(sql: string): Row[] | null {
    if (!/^\s*PRAGMA cipher_version\s*$/i.test(sql)) return null;
    return withoutCipher ? [] : [{ cipher_version: 'fake' }];
  }

  function guard() {
    if (!readable) throw new Error('file is not a database');
    refresh();
  }

  return {
    async exec(sql) {
      guard();
      db.exec(sql);
      persist();
    },
    async run(sql, params = []) {
      guard();
      db.prepare(sql).run(...(params as SqlValue[]));
      persist();
    },
    async all(sql, params = []) {
      const cipher = cipherVersion(sql);
      if (cipher) return cipher;
      guard();
      const rows = db.prepare(sql).all(...(params as SqlValue[])) as Row[];
      return rows.map((row) => ({ ...row }));
    },
    async close() {
      db.close();
      onClose();
    },
  };
}

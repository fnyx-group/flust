import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import type { Connection } from '@/data/database';
import type { DatabaseDriver } from '@/data/storage-deps';

export const expoDriver: DatabaseDriver = {
  async open(name, key) {
    const db = await openDatabaseAsync(name, { useNewConnection: true });
    try {
      // The raw hex form skips SQLCipher's key derivation: the key is already 256 random bits.
      await db.execAsync(`PRAGMA key = "x'${key}'"`);
    } catch (error) {
      await db.closeAsync();
      throw error;
    }
    return toConnection(db);
  },
};

function toConnection(db: SQLiteDatabase): Connection {
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params = []) => {
      await db.runAsync(sql, [...params]);
    },
    all: (sql, params = []) => db.getAllAsync<Record<string, unknown>>(sql, [...params]),
    close: () => db.closeAsync(),
  };
}

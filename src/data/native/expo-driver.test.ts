import { openDatabaseAsync } from 'expo-sqlite';

import { expoDriver } from '@/data/native/expo-driver';
import { isStorageKey, type StorageKey } from '@/data/storage-key';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const KEY = storageKey('ab'.repeat(32));

function storageKey(value: string): StorageKey {
  if (!isStorageKey(value)) throw new Error('Expected a valid key');
  return value;
}

function databaseThat({ keyFails, closeFails }: { keyFails: boolean; closeFails: boolean }) {
  const db = {
    execAsync: jest.fn(async () => {
      if (keyFails) throw new Error('key refused');
    }),
    closeAsync: jest.fn(async () => {
      if (closeFails) throw new Error('close failed');
    }),
  };
  jest.mocked(openDatabaseAsync).mockResolvedValue(db as never);
  return db;
}

describe('expo driver', () => {
  it('keeps the key error when closing fails too', async () => {
    const db = databaseThat({ keyFails: true, closeFails: true });

    await expect(expoDriver.open('flust.db', KEY)).rejects.toThrow('key refused');
    expect(db.closeAsync).toHaveBeenCalledTimes(1);
  });

  it('closes the database when the key cannot be set', async () => {
    const db = databaseThat({ keyFails: true, closeFails: false });

    await expect(expoDriver.open('flust.db', KEY)).rejects.toThrow('key refused');
    expect(db.closeAsync).toHaveBeenCalledTimes(1);
  });

  it('sets the key as raw hex, without key derivation', async () => {
    const db = databaseThat({ keyFails: false, closeFails: false });

    await expoDriver.open('flust.db', KEY);
    expect(db.execAsync).toHaveBeenCalledWith(`PRAGMA key = "x'${KEY}'"`);
    expect(db.closeAsync).not.toHaveBeenCalled();
  });
});

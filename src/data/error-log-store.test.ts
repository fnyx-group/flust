import { createErrorLog, type BinaryFile, type SealedBox } from '@/data/error-log-store';
import type { StorageKey } from '@/data/storage-key';
import { MAX_ENTRIES, type ErrorEntry } from '@/domain/error-log';
import { createFakeKeyStore, createFakeRandomBytes } from '@test/fakes/fake-key-store';

function entry(at: number): ErrorEntry {
  return { at, kind: 'render', route: '/journal', name: 'TypeError', code: null, frames: [] };
}

function keyBytes(key: StorageKey): number[] {
  return Array.from(key, (character) => character.charCodeAt(0));
}

// Stands in for AES-GCM: the key is written in front, and opening with any other key fails, as
// the authentication tag would. The rest is masked so that no plain text reaches the file.
const fakeBox: SealedBox = {
  async seal(plain, key) {
    return Uint8Array.from([...keyBytes(key), ...Array.from(plain, (byte) => byte ^ 0x5a)]);
  },
  async open(sealed, key) {
    const prefix = keyBytes(key);
    if (prefix.some((byte, index) => sealed[index] !== byte)) throw new Error('Wrong key');
    return Uint8Array.from(sealed.slice(prefix.length), (byte) => byte ^ 0x5a);
  },
};

type FakeFile = BinaryFile & {
  bytes: Uint8Array | null;
  failRead: boolean;
  failWrite: boolean;
  failRemove: boolean;
  writes: number;
};

function createFakeFile(): FakeFile {
  return {
    bytes: null,
    failRead: false,
    failWrite: false,
    failRemove: false,
    writes: 0,
    async read() {
      if (this.failRead) throw new Error('Unreadable');
      return this.bytes;
    },
    async write(bytes) {
      if (this.failWrite) throw new Error('Disk full');
      this.writes += 1;
      this.bytes = bytes;
    },
    async remove() {
      if (this.failRemove) throw new Error('Busy');
      this.bytes = null;
    },
  };
}

function setUp() {
  const keyStore = createFakeKeyStore();
  const file = createFakeFile();
  const deps = { keyStore, randomBytes: createFakeRandomBytes(), box: fakeBox, file };
  return { keyStore, file, deps, log: createErrorLog(deps) };
}

describe('createErrorLog', () => {
  it('writes entries sealed with its own key, which the next launch reads back', async () => {
    const { keyStore, file, deps, log } = setUp();

    await log.record(entry(1));
    await log.record(entry(2));

    expect(keyStore.value).toMatch(/^[0-9a-f]{64}$/);
    expect(String.fromCharCode(...(file.bytes ?? []))).not.toContain('journal');
    expect(await createErrorLog(deps).entries()).toEqual([entry(1), entry(2)]);
  });

  it('keeps the last entries', async () => {
    const { deps, log } = setUp();

    for (let at = 0; at < MAX_ENTRIES + 3; at += 1) await log.record(entry(at));

    const stored = await createErrorLog(deps).entries();
    expect(stored).toHaveLength(MAX_ENTRIES);
    expect(stored[0]).toEqual(entry(3));
  });

  it('keeps entries in memory while the keystore cannot be read, and writes them once it can', async () => {
    const { keyStore, file, deps, log } = setUp();
    await log.record(entry(1));
    keyStore.failGet = true;
    const later = createErrorLog(deps);

    await later.record(entry(2));
    expect(await later.entries()).toEqual([entry(2)]);
    expect(file.writes).toBe(1);

    keyStore.failGet = false;
    await later.record(entry(3));
    expect(await createErrorLog(deps).entries()).toEqual([entry(1), entry(2), entry(3)]);
  });

  it('keeps entries in memory when no key can be created', async () => {
    const { keyStore, file, log } = setUp();
    keyStore.failSet = true;

    await log.record(entry(1));

    expect(await log.entries()).toEqual([entry(1)]);
    expect(file.bytes).toBeNull();
  });

  it('starts a new log over a file sealed with a lost key', async () => {
    const { keyStore, deps, log } = setUp();
    await log.record(entry(1));
    keyStore.value = null;
    const after = createErrorLog(deps);

    await after.record(entry(2));

    expect(await createErrorLog(deps).entries()).toEqual([entry(2)]);
  });

  it('starts a new log over a damaged file', async () => {
    const { file, deps, log } = setUp();
    await log.record(entry(1));
    file.bytes = Uint8Array.of(1, 2, 3);
    const after = createErrorLog(deps);
    expect(await after.entries()).toEqual([]);

    await after.record(entry(2));
    expect(await createErrorLog(deps).entries()).toEqual([entry(2)]);
  });

  it('keeps the stored entries when the file cannot be read for a while', async () => {
    const { file, deps, log } = setUp();
    await log.record(entry(1));
    file.failRead = true;
    const later = createErrorLog(deps);

    await later.record(entry(2));
    expect(await later.entries()).toEqual([entry(2)]);
    expect(file.writes).toBe(1);

    file.failRead = false;
    await later.record(entry(3));
    expect(await createErrorLog(deps).entries()).toEqual([entry(1), entry(2), entry(3)]);
  });

  it('never rejects when the file cannot be written, and keeps the entry in memory', async () => {
    const { file, log } = setUp();
    file.failWrite = true;

    await expect(log.record(entry(1))).resolves.toBeUndefined();
    expect(await log.entries()).toEqual([entry(1)]);
  });

  it('writes concurrent records one after the other, without losing any', async () => {
    const { deps, log } = setUp();

    await Promise.all([log.record(entry(1)), log.record(entry(2)), log.record(entry(3))]);

    expect(await createErrorLog(deps).entries()).toEqual([entry(1), entry(2), entry(3)]);
  });

  it('clears the file, the key and the memory, then starts again with a new key', async () => {
    const { keyStore, file, log } = setUp();
    await log.record(entry(1));
    const firstKey = keyStore.value;

    expect(await log.clear()).toEqual({ ok: true, value: undefined });
    expect(file.bytes).toBeNull();
    expect(keyStore.value).toBeNull();
    expect(await log.entries()).toEqual([]);

    await log.record(entry(2));
    expect(keyStore.value).not.toBe(firstKey);
    expect(await log.entries()).toEqual([entry(2)]);
  });

  it('reports a clear that failed', async () => {
    const { file, log } = setUp();
    await log.record(entry(1));
    file.failRemove = true;

    expect(await log.clear()).toEqual({ ok: false, error: 'clear-failed' });
  });

  it('touches neither the key nor the file while paused, and writes again once resumed', async () => {
    const { keyStore, file, deps, log } = setUp();
    await log.record(entry(1));
    const resume = log.pause();

    expect(await log.clear()).toEqual({ ok: true, value: undefined });
    await log.record(entry(2));
    expect(keyStore.value).toBeNull();
    expect(file.bytes).toBeNull();
    expect(await log.entries()).toEqual([entry(2)]);

    resume();
    resume();
    await log.record(entry(3));
    expect(await createErrorLog(deps).entries()).toEqual([entry(2), entry(3)]);
  });
});

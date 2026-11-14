import { createKey, isStorageKey, readKey } from '@/data/storage-key';
import { err, ok } from '@/domain/result';
import { createFakeKeyStore, createFakeRandomBytes } from '@test/fakes/fake-key-store';

const VALID_KEY = 'ab'.repeat(32);

describe('isStorageKey', () => {
  it('accepts 64 lowercase hex characters only', () => {
    expect(isStorageKey(VALID_KEY)).toBe(true);
    expect(isStorageKey(VALID_KEY.toUpperCase())).toBe(false);
    expect(isStorageKey('ab'.repeat(31))).toBe(false);
    expect(isStorageKey(`${VALID_KEY}00`)).toBe(false);
    expect(isStorageKey(`${'ab'.repeat(31)}"x`)).toBe(false);
    expect(isStorageKey(null)).toBe(false);
  });
});

describe('readKey', () => {
  it('returns the stored key', async () => {
    expect(await readKey(createFakeKeyStore(VALID_KEY))).toEqual(ok(VALID_KEY));
  });

  it('returns null when there is no key', async () => {
    expect(await readKey(createFakeKeyStore())).toEqual(ok(null));
  });

  it('treats a malformed key as no key', async () => {
    expect(await readKey(createFakeKeyStore('not a key'))).toEqual(ok(null));
  });

  it('reports a keystore that cannot be read, without treating it as a missing key', async () => {
    const store = createFakeKeyStore(VALID_KEY);
    store.failGet = true;
    expect(await readKey(store)).toEqual(err('key-unavailable'));
  });
});

describe('createKey', () => {
  it('stores 32 random bytes as hex', async () => {
    const store = createFakeKeyStore();
    const randomBytes = jest.fn(async (count: number) => new Uint8Array(count).fill(0xa5));

    const key = await createKey(store, randomBytes);

    expect(randomBytes).toHaveBeenCalledWith(32);
    expect(key).toEqual(ok('a5'.repeat(32)));
    expect(store.value).toBe('a5'.repeat(32));
  });

  it('creates a different key each time', async () => {
    const randomBytes = createFakeRandomBytes();
    const first = await createKey(createFakeKeyStore(), randomBytes);
    const second = await createKey(createFakeKeyStore(), randomBytes);
    expect(first).not.toEqual(second);
  });

  it('rejects a source that returns the wrong number of bytes', async () => {
    const store = createFakeKeyStore();
    const key = await createKey(store, async () => new Uint8Array(16));
    expect(key).toEqual(err('key-unavailable'));
    expect(store.value).toBeNull();
  });

  it('fails when the random source fails', async () => {
    const key = await createKey(createFakeKeyStore(), async () => {
      throw new Error('no entropy');
    });
    expect(key).toEqual(err('key-unavailable'));
  });

  it('fails when the key cannot be written', async () => {
    const store = createFakeKeyStore();
    store.failSet = true;
    expect(await createKey(store, createFakeRandomBytes())).toEqual(err('key-unavailable'));
  });

  it('fails when the written key does not read back', async () => {
    const store = createFakeKeyStore();
    store.dropWrites = true;
    expect(await createKey(store, createFakeRandomBytes())).toEqual(err('key-unavailable'));
  });
});

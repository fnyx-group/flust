import { err, ok, type Result } from '@/domain/result';

declare const storageKeyBrand: unique symbol;

// 64 lowercase hex characters. Branded so that only a validated key reaches the PRAGMA key
// statement, which cannot take it as a bound parameter.
export type StorageKey = string & { readonly [storageKeyBrand]: true };

export type KeyStore = {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
  remove(): Promise<void>;
};

export type RandomBytes = (count: number) => Promise<Uint8Array>;

export type KeyError = 'key-unavailable';

const KEY_BYTES = 32;
const KEY_PATTERN = /^[0-9a-f]{64}$/;

export function isStorageKey(value: unknown): value is StorageKey {
  return typeof value === 'string' && KEY_PATTERN.test(value);
}

// A malformed value reads as no key: it can never decrypt anything.
export async function readKey(store: KeyStore): Promise<Result<StorageKey | null, KeyError>> {
  try {
    const value = await store.get();
    return ok(isStorageKey(value) ? value : null);
  } catch {
    return err('key-unavailable');
  }
}

export async function createKey(
  store: KeyStore,
  randomBytes: RandomBytes,
): Promise<Result<StorageKey, KeyError>> {
  try {
    const key = toHex(await randomBytes(KEY_BYTES));
    if (!isStorageKey(key)) return err('key-unavailable');
    await store.set(key);
    // A database created with a key that was not actually stored could never be opened again.
    if ((await store.get()) !== key) return err('key-unavailable');
    return ok(key);
  } catch {
    return err('key-unavailable');
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

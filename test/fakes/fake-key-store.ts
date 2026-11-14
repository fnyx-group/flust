import type { KeyStore, RandomBytes } from '@/data/storage-key';

export type FakeKeyStore = KeyStore & {
  value: string | null;
  failGet: boolean;
  failSet: boolean;
  failRemove: boolean;
  // Accepts writes without keeping them, as a broken keystore could.
  dropWrites: boolean;
};

export function createFakeKeyStore(value: string | null = null): FakeKeyStore {
  return {
    value,
    failGet: false,
    failSet: false,
    failRemove: false,
    dropWrites: false,
    async get() {
      if (this.failGet) throw new Error('Keystore unavailable');
      return this.value;
    },
    async set(next) {
      if (this.failSet) throw new Error('Keystore unavailable');
      if (!this.dropWrites) this.value = next;
    },
    async remove() {
      if (this.failRemove) throw new Error('Keystore unavailable');
      this.value = null;
    },
  };
}

// Deterministic, and different on every call so that successive keys differ.
export function createFakeRandomBytes(): RandomBytes & { calls: number } {
  const randomBytes = async (count: number) => {
    randomBytes.calls += 1;
    return Uint8Array.from({ length: count }, (_, index) => (randomBytes.calls * 31 + index) % 256);
  };
  randomBytes.calls = 0;
  return randomBytes;
}

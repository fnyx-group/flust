import { createHash } from 'node:crypto';

// The compiled file, read by modules/flust-filter (Blocklist.kt):
//   magic "FLST", version (1 byte), 3 zero bytes, entry count (4 bytes, big-endian),
//   then each entry: the first 8 bytes of the SHA-256 of the domain, and its category bits,
//   sorted by hash as unsigned bytes.
// Hashes keep the file small and the domains unreadable in the app package. With 64 bits, a name
// outside the lists matches one by chance about once in 2^64 / entries lookups.
export const MAGIC = 'FLST';
export const FORMAT_VERSION = 1;
export const HEADER_BYTES = 12;
export const HASH_BYTES = 8;
export const ENTRY_BYTES = HASH_BYTES + 1;

export function domainHash(domain: string): Buffer {
  return createHash('sha256').update(domain, 'ascii').digest().subarray(0, HASH_BYTES);
}

export function compile(entries: ReadonlyMap<string, number>): Buffer {
  const hashed = [...entries].map(([domain, categories]) => ({
    domain,
    hash: domainHash(domain),
    categories,
  }));
  hashed.sort((a, b) => Buffer.compare(a.hash, b.hash));

  const output = Buffer.alloc(HEADER_BYTES + hashed.length * ENTRY_BYTES);
  output.write(MAGIC, 0, 'ascii');
  output.writeUInt8(FORMAT_VERSION, 4);
  output.writeUInt32BE(hashed.length, 8);
  hashed.forEach(({ domain, hash, categories }, index) => {
    const previous = hashed[index - 1];
    if (previous !== undefined && previous.hash.equals(hash)) {
      throw new Error(`Hash collision between ${previous.domain} and ${domain}`);
    }
    const offset = HEADER_BYTES + index * ENTRY_BYTES;
    hash.copy(output, offset);
    output.writeUInt8(categories, offset + HASH_BYTES);
  });
  return output;
}

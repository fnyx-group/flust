import { compile, domainHash, ENTRY_BYTES, HASH_BYTES, HEADER_BYTES } from './compile';

function entryAt(file: Buffer, index: number) {
  const offset = HEADER_BYTES + index * ENTRY_BYTES;
  return {
    hash: file.subarray(offset, offset + HASH_BYTES),
    categories: file.readUInt8(offset + HASH_BYTES),
  };
}

describe('compile', () => {
  const entries = new Map([
    ['adult.example', 1],
    ['nudify.example', 2],
    ['vpn.example', 8],
    ['google.fr', 16],
  ]);

  it('writes the header with the entry count', () => {
    const file = compile(entries);

    expect(file.subarray(0, 4).toString('ascii')).toBe('FLST');
    expect(file.readUInt8(4)).toBe(1);
    expect(file.readUInt32BE(8)).toBe(4);
    expect(file.length).toBe(HEADER_BYTES + 4 * ENTRY_BYTES);
  });

  it('sorts entries by hash as unsigned bytes, each with its categories', () => {
    const file = compile(entries);
    const read = [0, 1, 2, 3].map((index) => entryAt(file, index));

    for (let index = 1; index < read.length; index += 1) {
      expect(Buffer.compare(read[index - 1]!.hash, read[index]!.hash)).toBe(-1);
    }
    for (const [domain, categories] of entries) {
      const found = read.find((entry) => entry.hash.equals(domainHash(domain)));
      expect(found?.categories).toBe(categories);
    }
  });

  it('hashes the domain with SHA-256, first 8 bytes', () => {
    expect(domainHash('example.com').toString('hex')).toBe('a379a6f6eeafb9a5');
  });

  it('writes only the header for no entries', () => {
    expect(compile(new Map()).length).toBe(HEADER_BYTES);
  });
});

import { decodeLog, encodeLog } from '@/data/error-log-codec';
import { MAX_ENTRIES, type ErrorEntry } from '@/domain/error-log';

const entry: ErrorEntry = {
  at: 1_700_000_000_000,
  kind: 'render',
  route: '/journal',
  name: 'TypeError',
  code: null,
  frames: ['render@index.android.bundle:1:2'],
};

function bytesOf(text: string): Uint8Array {
  return Uint8Array.from(text, (character) => character.charCodeAt(0));
}

describe('error log codec', () => {
  it('reads back what it wrote', () => {
    expect(decodeLog(encodeLog([entry, { ...entry, kind: 'fatal' }]))).toEqual([
      entry,
      { ...entry, kind: 'fatal' },
    ]);
  });

  it('never writes an entry that does not validate', () => {
    const forged = { ...entry, name: 'my journal' };

    expect(decodeLog(encodeLog([forged, entry]))).toEqual([entry]);
  });

  it('drops stored entries that do not validate and keeps the others', () => {
    const text = JSON.stringify({ version: 1, entries: [{ ...entry, message: 'x' }, entry] });

    expect(decodeLog(bytesOf(text))).toEqual([entry]);
  });

  it('keeps the last entries of a file that holds too many', () => {
    const entries = Array.from({ length: MAX_ENTRIES + 5 }, (_, index) => ({
      ...entry,
      at: index,
    }));

    const decoded = decodeLog(bytesOf(JSON.stringify({ version: 1, entries })));

    expect(decoded).toHaveLength(MAX_ENTRIES);
    expect(decoded[0]?.at).toBe(5);
  });

  it.each([
    ['not JSON', bytesOf('{')],
    ['another version', bytesOf(JSON.stringify({ version: 2, entries: [entry] }))],
    ['not ASCII', Uint8Array.of(0x7b, 0xc3, 0xa9, 0x7d)],
    ['no entry list', bytesOf(JSON.stringify({ version: 1 }))],
  ])('reads a file that is %s as empty', (_label, bytes) => {
    expect(decodeLog(bytes)).toEqual([]);
  });
});

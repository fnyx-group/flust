import { arrayOf, isRecord, parseJson } from '@/data/json-codec';
import { appendEntries, isErrorEntry, type ErrorEntry } from '@/domain/error-log';

const FORMAT_VERSION = 1;
const MAX_ASCII = 0x7f;

// Every field of an entry is ASCII by validation, so the file needs no text encoder: one byte
// per character, and any other byte marks the file as damaged.
export function encodeLog(entries: readonly ErrorEntry[]): Uint8Array {
  const text = JSON.stringify({ version: FORMAT_VERSION, entries: entries.filter(isErrorEntry) });
  return Uint8Array.from(text, (character) => {
    const code = character.charCodeAt(0);
    if (code > MAX_ASCII) throw new Error('Error log entries must be ASCII.');
    return code;
  });
}

// Entries that do not validate are dropped one by one; a file that is not a log at all reads
// as empty.
export function decodeLog(bytes: Uint8Array): ErrorEntry[] {
  if (bytes.some((byte) => byte > MAX_ASCII)) return [];
  const value = parseJson(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
  if (!isRecord(value) || value.version !== FORMAT_VERSION) return [];
  return appendEntries([], arrayOf(value.entries).filter(isErrorEntry));
}

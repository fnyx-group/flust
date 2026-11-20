import { isRecord, parseJson } from '@/data/json-codec';
import {
  FILTER_CONFIRM_MS,
  FILTER_WAIT_MS,
  isFilterRequestKind,
  type SavedFilterRequest,
} from '@/domain/filter-request';
import { isTimestamp } from '@/domain/time';

export function encodeFilterRequest(saved: SavedFilterRequest): string {
  const { request, at } = saved;
  return JSON.stringify({
    kind: request.kind,
    leftMs: request.leftMs,
    wall: at.wall,
    elapsed: at.elapsed,
    boot: at.boot,
  });
}

// The value lives in the encrypted database and cannot be edited from outside, so damage is a
// bug: it reads as no request, which leaves the filter as it is.
export function decodeFilterRequest(text: string | null): SavedFilterRequest | null {
  const value = parseJson(text);
  if (!isRecord(value)) return null;
  const { kind, leftMs, wall, elapsed, boot } = value;
  if (!isFilterRequestKind(kind) || !isCount(leftMs)) return null;
  if (leftMs > FILTER_WAIT_MS + FILTER_CONFIRM_MS) return null;
  if (!isTimestamp(wall) || !isCount(elapsed)) return null;
  if (boot !== null && !isCount(boot)) return null;
  return { request: { kind, leftMs }, at: { wall, elapsed, boot } };
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

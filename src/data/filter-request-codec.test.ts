import { decodeFilterRequest, encodeFilterRequest } from '@/data/filter-request-codec';
import { FILTER_CONFIRM_MS, FILTER_WAIT_MS } from '@/domain/filter-request';

const SAVED = {
  request: { kind: 'filter' as const, leftMs: 12_000 },
  at: { wall: Date.UTC(2026, 10, 19, 21), elapsed: 3_600_000, boot: 4 },
};

describe('the filter request codec', () => {
  it('survives a round trip, with or without a boot count', () => {
    expect(decodeFilterRequest(encodeFilterRequest(SAVED))).toEqual(SAVED);
    const withoutBoot = { ...SAVED, at: { ...SAVED.at, boot: null } };
    expect(decodeFilterRequest(encodeFilterRequest(withoutBoot))).toEqual(withoutBoot);
  });

  it.each([
    null,
    'garbage',
    '[]',
    JSON.stringify({ ...SAVED.at, kind: 'adult', leftMs: 1 }),
    JSON.stringify({ ...SAVED.at, kind: 'youtube', leftMs: -1 }),
    JSON.stringify({
      ...SAVED.at,
      kind: 'youtube',
      leftMs: FILTER_WAIT_MS + FILTER_CONFIRM_MS + 1,
    }),
    JSON.stringify({ ...SAVED.at, kind: 'youtube', leftMs: 1, wall: 'yesterday' }),
    JSON.stringify({ ...SAVED.at, kind: 'youtube', leftMs: 1, elapsed: 1.5 }),
    JSON.stringify({ ...SAVED.at, kind: 'youtube', leftMs: 1, boot: 'first' }),
  ])('reads %s as no request', (text) => {
    expect(decodeFilterRequest(text)).toBeNull();
  });
});

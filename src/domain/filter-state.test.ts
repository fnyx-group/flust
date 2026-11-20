import { filterView, isFilterInactive, type FilterStatus } from '@/domain/filter-state';

const RUNNING: FilterStatus = {
  available: true,
  consent: true,
  running: true,
  enabled: true,
  youtubeStrict: false,
  stopReason: null,
  strictPrivateDns: false,
  otherVpn: false,
};

const STOPPED: FilterStatus = { ...RUNNING, running: false };

describe('the filter state', () => {
  it('is unavailable where there is no filter, as on iOS until lot 3', () => {
    expect(filterView({ available: false })).toEqual({ state: 'unavailable' });
  });

  it('is off when the person has not turned it on, whatever the network', () => {
    expect(filterView({ ...STOPPED, enabled: false, strictPrivateDns: true })).toEqual({
      state: 'off',
    });
  });

  it('is on while the tunnel runs', () => {
    expect(filterView(RUNNING)).toEqual({ state: 'on' });
  });

  it('is inactive while strict Private DNS sends the lookups around the tunnel', () => {
    expect(filterView({ ...RUNNING, strictPrivateDns: true })).toEqual({
      state: 'inactive',
      reason: 'private-dns',
    });
  });

  it.each([
    [{ stopReason: 'lists', otherVpn: true, consent: false }, 'lists'],
    [{ stopReason: 'revoked', otherVpn: true }, 'other-vpn'],
    [{ stopReason: 'revoked', consent: false }, 'consent'],
    [{ stopReason: 'no-consent', consent: false }, 'consent'],
    [{ stopReason: 'revoked' }, 'vpn-off'],
    [{ stopReason: 'boot-deferred' }, 'boot-deferred'],
    [{ stopReason: 'failed' }, 'stopped'],
    [{ stopReason: 'stopped' }, 'stopped'],
    [{ stopReason: null }, 'stopped'],
  ] as const)('gives the reason of a stopped filter %o: %s', (change, reason) => {
    const view = filterView({ ...STOPPED, ...change });

    expect(view).toEqual({ state: 'inactive', reason });
    expect(isFilterInactive(view)).toBe(true);
  });

  it('counts only an inactive filter as inactive', () => {
    expect(isFilterInactive(filterView(RUNNING))).toBe(false);
    expect(isFilterInactive(filterView({ available: false }))).toBe(false);
  });
});

import {
  alwaysOnValue,
  filterView,
  isFilterInactive,
  showsAlwaysOnGear,
  showsUnusedAppsRow,
  type FilterStatus,
} from '@/domain/filter-state';

const RUNNING: FilterStatus = {
  available: true,
  consent: true,
  running: true,
  enabled: true,
  youtubeStrict: false,
  stopReason: null,
  strictPrivateDns: false,
  otherVpn: false,
  alwaysOn: null,
  pausedIfUnused: null,
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

describe('the always-on row', () => {
  it('shows whether always-on names flust while the filter runs', () => {
    expect(alwaysOnValue({ ...RUNNING, alwaysOn: true })).toBe('on');
    expect(alwaysOnValue({ ...RUNNING, alwaysOn: false })).toBe('off');
  });

  it('shows no value when Android cannot tell, or without a filter', () => {
    expect(alwaysOnValue({ ...STOPPED, alwaysOn: null })).toBeNull();
    expect(alwaysOnValue({ available: false })).toBeNull();
  });

  it('points to the gear until always-on is known to name flust', () => {
    expect(showsAlwaysOnGear({ ...RUNNING, alwaysOn: false })).toBe(true);
    expect(showsAlwaysOnGear({ ...STOPPED, alwaysOn: null })).toBe(true);
    expect(showsAlwaysOnGear({ ...RUNNING, alwaysOn: true })).toBe(false);
    expect(showsAlwaysOnGear({ available: false })).toBe(false);
  });
});

describe('the unused apps row', () => {
  it('shows while the filter is wanted and Android would pause flust', () => {
    expect(showsUnusedAppsRow({ ...RUNNING, pausedIfUnused: true })).toBe(true);
    expect(showsUnusedAppsRow({ ...STOPPED, pausedIfUnused: true })).toBe(true);
  });

  it('goes away once the pause is off, where Android has none, or with the filter off', () => {
    expect(showsUnusedAppsRow({ ...RUNNING, pausedIfUnused: false })).toBe(false);
    expect(showsUnusedAppsRow({ ...RUNNING, pausedIfUnused: null })).toBe(false);
    expect(showsUnusedAppsRow({ ...STOPPED, enabled: false, pausedIfUnused: true })).toBe(false);
    expect(showsUnusedAppsRow({ available: false })).toBe(false);
  });
});

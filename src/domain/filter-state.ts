// What the Android filter reports, and the one state the app shows from it
// (docs/product/content-filter.md, Known limits).

export const FILTER_STOP_REASONS = [
  'stopped',
  'revoked',
  'no-consent',
  'failed',
  'lists',
  'boot-deferred',
] as const;
export type FilterStopReason = (typeof FILTER_STOP_REASONS)[number];

export type FilterStatus =
  | { readonly available: false }
  | {
      readonly available: true;
      // Android's VPN consent still holds.
      readonly consent: boolean;
      readonly running: boolean;
      // The person wants the filter on.
      readonly enabled: boolean;
      readonly youtubeStrict: boolean;
      readonly stopReason: FilterStopReason | null;
      readonly strictPrivateDns: boolean;
      readonly otherVpn: boolean;
      // Whether Android's always-on VPN names flust, or null when only a running filter can tell.
      readonly alwaysOn: boolean | null;
      // Whether Android pauses flust when it is not opened for months, which stops the filter, or
      // null where Android has no such pause.
      readonly pausedIfUnused: boolean | null;
    };

export const FILTER_INACTIVE_REASONS = [
  'private-dns',
  'other-vpn',
  'consent',
  'vpn-off',
  'lists',
  'boot-deferred',
  'stopped',
] as const;
export type FilterInactiveReason = (typeof FILTER_INACTIVE_REASONS)[number];

export type FilterView =
  | { readonly state: 'unavailable' }
  | { readonly state: 'off' }
  | { readonly state: 'on' }
  | { readonly state: 'inactive'; readonly reason: FilterInactiveReason };

// The filter is inactive whenever it is wanted and does not protect: stopped, or running while
// strict Private DNS sends the lookups around it. The reasons follow what the person can do, most
// specific first.
export function filterView(status: FilterStatus): FilterView {
  if (!status.available) return { state: 'unavailable' };
  if (!status.enabled) return { state: 'off' };
  if (status.running) {
    return status.strictPrivateDns ? { state: 'inactive', reason: 'private-dns' } : { state: 'on' };
  }
  return { state: 'inactive', reason: stoppedReason(status) };
}

function stoppedReason(status: Extract<FilterStatus, { available: true }>): FilterInactiveReason {
  if (status.stopReason === 'lists') return 'lists';
  if (status.otherVpn) return 'other-vpn';
  if (!status.consent) return 'consent';
  if (status.stopReason === 'revoked') return 'vpn-off';
  if (status.stopReason === 'boot-deferred') return 'boot-deferred';
  return 'stopped';
}

export function isFilterInactive(view: FilterView): boolean {
  return view.state === 'inactive';
}

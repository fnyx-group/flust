import type { FilterRequestKind } from '@/domain/filter-request';
import type { FilterBridge } from '@/features/filter/filter-bridge';

export type EnableOutcome = 'started' | 'needs-disclosure' | 'refused' | 'failed';

// Turns the filter on, or brings it back after Android stopped it. Android's VPN dialog only
// shows after flust's own disclosure, which Google Play requires before consent: without
// `disclosed`, a missing consent asks for that disclosure first.
export async function enableFilter(
  bridge: FilterBridge,
  youtubeStrict: boolean,
  disclosed: boolean,
): Promise<EnableOutcome> {
  const status = bridge.status();
  if (!status.available) return 'failed';
  if (!status.consent) {
    if (!disclosed) return 'needs-disclosure';
    if (!(await bridge.requestConsent())) return 'refused';
  }
  return (await bridge.start({ youtubeStrict })) ? 'started' : 'failed';
}

// Strengthening is immediate: YouTube strict applies at once, on a new tunnel that empties
// Android's DNS cache. Only a filter that is on takes it, so the switch has no effect while it is
// off.
export async function turnYoutubeStrictOn(bridge: FilterBridge): Promise<boolean> {
  const status = bridge.status();
  if (!status.available || !status.enabled) return false;
  return bridge.start({ youtubeStrict: true });
}

// Applies a request once it is confirmed, after its wait (docs/decisions/0040-filter-delay.md).
export async function applyWeakening(
  bridge: FilterBridge,
  kind: FilterRequestKind,
): Promise<boolean> {
  if (kind === 'filter') {
    await bridge.stop();
    return true;
  }
  const status = bridge.status();
  if (!status.available || !status.enabled) return false;
  return bridge.start({ youtubeStrict: false });
}

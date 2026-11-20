import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  requestPhase,
  requestWeakening,
  type FilterRequest,
  type FilterRequestKind,
  type FilterRequestPhase,
} from '@/domain/filter-request';
import { useCountdown } from '@/features/clock/use-countdown';
import { applyWeakening } from '@/features/filter/filter-actions';
import { readFilterClock } from '@/features/filter/filter-clock';
import { filterBridge } from '@/features/filter/filter-native';
import { useStorage } from '@/features/storage/storage-context';

export type PendingRequest = { readonly kind: FilterRequestKind } & FilterRequestPhase;

// The request to weaken the filter, stored so it survives a restart, counted on the continuous
// clock, cleared when it is cancelled, applied or expired (docs/decisions/0040-filter-delay.md).
// Clearing it also closes its confirmation sheet, so a sheet left open never comes back by itself
// with the next request.
export function useFilterRequest(onApplied: () => void) {
  const storage = useStorage();
  const [request, setRequest] = useState<FilterRequest | null>(null);
  const [confirming, setConfirming] = useState(false);
  // Bumped on each change, so a load started before it never lands.
  const change = useRef(0);

  const clear = useCallback(() => {
    change.current += 1;
    setRequest(null);
    setConfirming(false);
    void storage.filter.clearRequest();
  }, [storage]);

  useEffect(() => {
    const started = change.current;
    void storage.filter.loadRequest(readFilterClock()).then((result) => {
      if (started !== change.current || !result.ok || result.value === null) return;
      if (requestPhase(result.value).phase === 'expired') clear();
      else setRequest(result.value);
    });
  }, [storage, clear]);

  const save = useCallback(
    (leftMs: number) => {
      if (request !== null) {
        void storage.filter.saveRequest({ kind: request.kind, leftMs }, readFilterClock());
      }
    },
    [storage, request],
  );

  const wait = useMemo(() => (request === null ? null : { ms: request.leftMs }), [request]);
  const remaining = useCountdown(wait, { save, onEnd: clear });
  const pending: PendingRequest | null =
    request === null
      ? null
      : { kind: request.kind, ...requestPhase({ ...request, leftMs: remaining }) };

  function ask(kind: FilterRequestKind) {
    const next = requestWeakening(kind);
    change.current += 1;
    setRequest(next);
    void storage.filter.saveRequest(next, readFilterClock());
  }

  async function confirm() {
    if (pending?.phase !== 'confirm') return;
    clear();
    await applyWeakening(filterBridge, pending.kind);
    onApplied();
  }

  return {
    pending,
    ask,
    cancel: clear,
    confirm,
    confirming: confirming && pending?.phase === 'confirm',
    openConfirm: () => setConfirming(true),
    closeConfirm: () => setConfirming(false),
  };
}

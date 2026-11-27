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

// What the screen says when a request did not go through: the filter, or YouTube strict, stays on.
export type RequestFailure = 'saveFailed' | 'failed.filter' | 'failed.youtube';

// The request to weaken the filter, stored so it survives a restart, counted on the continuous
// clock, cleared when it is cancelled, applied or expired (docs/decisions/0040-filter-delay.md).
// Clearing it also closes its confirmation sheet, so a sheet left open never comes back by itself
// with the next request. A request shows only once it is saved, and stays until it is applied, so
// the screen never shows a wait or a change that did not happen.
export function useFilterRequest(onApplied: () => void) {
  const storage = useStorage();
  const [request, setRequest] = useState<FilterRequest | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<RequestFailure | null>(null);
  // Bumped on each change, so a load started before it never lands.
  const change = useRef(0);

  const clear = useCallback(() => {
    change.current += 1;
    setRequest(null);
    setConfirming(false);
    setFailure(null);
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

  async function ask(kind: FilterRequestKind) {
    const next = requestWeakening(kind);
    change.current += 1;
    const asked = change.current;
    setFailure(null);
    const saved = await storage.filter.saveRequest(next, readFilterClock());
    if (asked !== change.current) return;
    if (saved.ok) setRequest(next);
    else setFailure('saveFailed');
  }

  async function confirm() {
    if (pending?.phase !== 'confirm') return;
    const { kind } = pending;
    setFailure(null);
    const applied = await applyWeakening(filterBridge, kind);
    if (applied) clear();
    else setFailure(`failed.${kind}`);
    onApplied();
  }

  return {
    pending,
    failure,
    ask,
    cancel: clear,
    confirm,
    confirming: confirming && pending?.phase === 'confirm',
    openConfirm: () => setConfirming(true),
    closeConfirm: () => setConfirming(false),
  };
}

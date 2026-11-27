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
//
// Writes to storage run one after the other, in the order they are asked, so the stored request
// is always the one shown. `busy` covers a request being saved or applied: the screen takes no
// other change meanwhile, and a second tap does nothing.
export function useFilterRequest(onApplied: () => void) {
  const storage = useStorage();
  const [request, setRequest] = useState<FilterRequest | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<RequestFailure | null>(null);
  const [busy, setBusy] = useState(false);
  // Read and set in the same tap, before React renders again.
  const working = useRef(false);
  // Bumped on each change, so a load, a save or an apply started before it never lands.
  const change = useRef(0);
  const writes = useRef<Promise<unknown>>(Promise.resolve());

  const write = useCallback(<T>(task: () => Promise<T>): Promise<T> => {
    const next = writes.current.then(task, task);
    writes.current = next.catch(() => undefined);
    return next;
  }, []);

  const clear = useCallback(() => {
    change.current += 1;
    setRequest(null);
    setConfirming(false);
    setFailure(null);
    void write(() => storage.filter.clearRequest());
  }, [storage, write]);

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
      // A request being replaced is not saved again over the new one.
      if (request === null || working.current) return;
      const at = readFilterClock();
      void write(() => storage.filter.saveRequest({ kind: request.kind, leftMs }, at));
    },
    [storage, request, write],
  );

  const wait = useMemo(() => (request === null ? null : { ms: request.leftMs }), [request]);
  const remaining = useCountdown(wait, { save, onEnd: clear });
  const pending: PendingRequest | null =
    request === null
      ? null
      : { kind: request.kind, ...requestPhase({ ...request, leftMs: remaining }) };

  function start(): number | null {
    if (working.current) return null;
    working.current = true;
    setBusy(true);
    setFailure(null);
    change.current += 1;
    return change.current;
  }

  function end() {
    working.current = false;
    setBusy(false);
  }

  async function ask(kind: FilterRequestKind) {
    const next = requestWeakening(kind);
    const asked = start();
    if (asked === null) return;
    const at = readFilterClock();
    const saved = await write(() => storage.filter.saveRequest(next, at));
    end();
    if (asked !== change.current) return;
    if (saved.ok) setRequest(next);
    else setFailure('saveFailed');
  }

  async function confirm() {
    if (pending?.phase !== 'confirm') return;
    const { kind } = pending;
    const asked = start();
    if (asked === null) return;
    const applied = await applyWeakening(filterBridge, kind);
    end();
    // Cancelled or expired meanwhile: the screen already shows what is left.
    if (asked === change.current) {
      if (applied) clear();
      else setFailure(`failed.${kind}`);
    }
    onApplied();
  }

  return {
    pending,
    failure,
    busy,
    ask,
    cancel: clear,
    confirm,
    confirming: confirming && pending?.phase === 'confirm',
    openConfirm: () => setConfirming(true),
    closeConfirm: () => setConfirming(false),
  };
}

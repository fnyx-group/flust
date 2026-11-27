import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import type { FilterRepository } from '@/data/filter-repository';
import type { Storage } from '@/data/open-storage';
import { FILTER_CONFIRM_MS, type FilterRequest } from '@/domain/filter-request';
import { err, ok, type Result } from '@/domain/result';
import { filterBridge } from '@/features/filter/filter-native';
import { useFilterRequest } from '@/features/filter/use-filter-request';
import { StorageContext } from '@/features/storage/storage-context';

jest.mock('@/features/filter/filter-native', () => ({
  filterBridge: {
    status: () => ({ available: true, enabled: true }),
    stop: jest.fn(async () => true),
    start: jest.fn(async () => true),
  },
}));

const stop = filterBridge.stop as jest.Mock;
const READY: FilterRequest = { kind: 'filter', leftMs: FILTER_CONFIRM_MS / 2 };

function repository(overrides: Partial<FilterRepository> = {}): FilterRepository {
  return {
    loadRequest: jest.fn(async () => ok(null)),
    saveRequest: jest.fn(async () => ok(undefined)),
    clearRequest: jest.fn(async () => ok(undefined)),
    ...overrides,
  };
}

async function render(filter: FilterRepository) {
  const storage = { filter } as unknown as Storage;
  const wrapper = ({ children }: PropsWithChildren) => (
    <StorageContext value={storage}>{children}</StorageContext>
  );
  return renderHook(() => useFilterRequest(() => undefined), { wrapper });
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

describe('useFilterRequest', () => {
  beforeEach(() => stop.mockClear());

  // The request used to show, and its countdown to run, before the save had landed.
  it('shows a request only once it is saved', async () => {
    const save = deferred<Result<void, 'storage-failed'>>();
    const saveRequest = jest.fn(() => save.promise);
    const { result } = await render(repository({ saveRequest }));

    let asking: Promise<void> = Promise.resolve();
    await act(async () => {
      asking = result.current.ask('filter');
    });
    expect(result.current.pending).toBeNull();
    expect(result.current.busy).toBe(true);

    await act(async () => {
      save.resolve(ok(undefined));
      await asking;
    });
    expect(result.current.pending).toMatchObject({ kind: 'filter', phase: 'waiting' });
    expect(result.current.busy).toBe(false);
    expect(result.current.failure).toBeNull();
  });

  // The countdown used to run even though the request was lost at the next start.
  it('shows no wait for a request that could not be saved', async () => {
    const saveRequest = jest.fn(async () => err('storage-failed' as const));
    const { result } = await render(repository({ saveRequest }));

    await act(() => result.current.ask('filter'));

    expect(result.current.pending).toBeNull();
    expect(result.current.failure).toBe('saveFailed');
  });

  it('ignores a second request while the first is being saved', async () => {
    const save = deferred<Result<void, 'storage-failed'>>();
    const saveRequest = jest.fn((_request: FilterRequest) => save.promise);
    const { result } = await render(repository({ saveRequest }));

    let first: Promise<void> = Promise.resolve();
    await act(async () => {
      first = result.current.ask('filter');
    });
    await act(() => result.current.ask('youtube'));
    await act(async () => {
      save.resolve(ok(undefined));
      await first;
    });

    // The countdown saves the shown request again as it starts.
    expect(saveRequest.mock.calls.map(([saved]) => saved.kind)).not.toContain('youtube');
    expect(result.current.pending?.kind).toBe('filter');
  });

  // The clear must land after the save it follows, or the cancelled request would come back.
  it('clears a request cancelled while it was being saved, after the save', async () => {
    const save = deferred<Result<void, 'storage-failed'>>();
    const calls: string[] = [];
    const saveRequest = jest.fn(async () => {
      const saved = await save.promise;
      calls.push('save');
      return saved;
    });
    const clearRequest = jest.fn(async () => {
      calls.push('clear');
      return ok(undefined);
    });
    const { result } = await render(repository({ saveRequest, clearRequest }));

    let asking: Promise<void> = Promise.resolve();
    await act(async () => {
      asking = result.current.ask('filter');
    });
    await act(async () => result.current.cancel());
    await act(async () => {
      save.resolve(ok(undefined));
      await asking;
    });
    await waitFor(() => expect(clearRequest).toHaveBeenCalled());

    expect(calls).toEqual(['save', 'clear']);
    expect(result.current.pending).toBeNull();
  });

  it('clears a request once the filter is off', async () => {
    const clearRequest = jest.fn(async () => ok(undefined));
    const loadRequest = jest.fn(async () => ok(READY));
    const { result } = await render(repository({ loadRequest, clearRequest }));
    await waitFor(() => expect(result.current.pending?.phase).toBe('confirm'));

    await act(() => result.current.confirm());

    expect(stop).toHaveBeenCalled();
    expect(result.current.pending).toBeNull();
    expect(clearRequest).toHaveBeenCalled();
  });

  // The screen showed the request as applied while the filter stayed on.
  it('keeps the request and says so when the filter could not be turned off', async () => {
    stop.mockResolvedValueOnce(false);
    const clearRequest = jest.fn(async () => ok(undefined));
    const loadRequest = jest.fn(async () => ok(READY));
    const { result } = await render(repository({ loadRequest, clearRequest }));
    await waitFor(() => expect(result.current.pending?.phase).toBe('confirm'));

    await act(() => result.current.confirm());

    expect(result.current.pending).toMatchObject({ kind: 'filter', phase: 'confirm' });
    expect(result.current.failure).toBe('failed.filter');
    expect(clearRequest).not.toHaveBeenCalled();
  });

  it('applies a request once when it is confirmed twice', async () => {
    const stopped = deferred<boolean>();
    stop.mockReturnValueOnce(stopped.promise);
    const loadRequest = jest.fn(async () => ok(READY));
    const { result } = await render(repository({ loadRequest }));
    await waitFor(() => expect(result.current.pending?.phase).toBe('confirm'));

    let first: Promise<void> = Promise.resolve();
    await act(async () => {
      first = result.current.confirm();
    });
    expect(result.current.busy).toBe(true);
    await act(() => result.current.confirm());
    await act(async () => {
      stopped.resolve(true);
      await first;
    });

    expect(stop).toHaveBeenCalledTimes(1);
    expect(result.current.busy).toBe(false);
  });

  it('ignores the result of a stop for a request cancelled meanwhile', async () => {
    const stopped = deferred<boolean>();
    stop.mockReturnValueOnce(stopped.promise);
    const loadRequest = jest.fn(async () => ok(READY));
    const { result } = await render(repository({ loadRequest }));
    await waitFor(() => expect(result.current.pending?.phase).toBe('confirm'));

    let confirming: Promise<void> = Promise.resolve();
    await act(async () => {
      confirming = result.current.confirm();
    });
    await act(async () => result.current.cancel());
    await act(async () => {
      stopped.resolve(false);
      await confirming;
    });

    expect(result.current.pending).toBeNull();
    expect(result.current.failure).toBeNull();
  });
});

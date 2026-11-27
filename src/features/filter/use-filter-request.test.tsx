import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import type { FilterRepository } from '@/data/filter-repository';
import type { Storage } from '@/data/open-storage';
import { FILTER_CONFIRM_MS, type FilterRequest } from '@/domain/filter-request';
import { err, ok } from '@/domain/result';
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

describe('useFilterRequest', () => {
  beforeEach(() => stop.mockClear());

  it('shows a request once it is saved', async () => {
    const { result } = await render(repository());

    await act(() => result.current.ask('filter'));

    expect(result.current.pending).toMatchObject({ kind: 'filter', phase: 'waiting' });
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
});

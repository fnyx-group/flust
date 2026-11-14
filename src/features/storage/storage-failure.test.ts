import { failureScreen } from '@/features/storage/storage-failure';

describe('failureScreen', () => {
  it.each(['key-missing', 'database-unreadable', 'journey-corrupted'] as const)(
    'offers a reset for %s',
    (failure) => {
      expect(failureScreen(failure)).toEqual({ kind: 'reset', reason: failure });
    },
  );

  it.each([
    'key-unavailable',
    'cipher-unavailable',
    'schema-too-new',
    'migration-failed',
    'storage-unavailable',
    'reset-failed',
    'storage-failed',
  ] as const)('never offers a reset for %s', (failure) => {
    expect(failureScreen(failure)).toEqual({ kind: 'retry', reason: failure });
  });
});

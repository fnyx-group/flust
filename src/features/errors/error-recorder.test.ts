import { createErrorRecorder } from '@/features/errors/error-recorder';
import type { ErrorEntry } from '@/domain/error-log';

describe('createErrorRecorder', () => {
  it('records the error at the current time, without its message', async () => {
    const recorded: ErrorEntry[] = [];
    const record = createErrorRecorder(
      { record: async (entry) => void recorded.push(entry) },
      () => 42,
    );
    const error = new TypeError('my journal entry');

    await record(error, { kind: 'render', route: '/journal' });

    expect(recorded).toEqual([
      {
        at: 42,
        kind: 'render',
        route: '/journal',
        name: 'TypeError',
        code: null,
        frames: expect.any(Array),
      },
    ]);
    expect(JSON.stringify(recorded)).not.toContain('my journal');
  });

  it('never rejects when the log fails', async () => {
    const record = createErrorRecorder(
      {
        record: async () => {
          throw new Error('Disk full');
        },
      },
      () => 0,
    );

    await expect(record(new Error('x'), { kind: 'fatal' })).resolves.toBeUndefined();
  });

  it('records an error once, under the screen where it first showed, whatever the path does next', async () => {
    const recorded: ErrorEntry[] = [];
    const record = createErrorRecorder(
      { record: async (entry) => void recorded.push(entry) },
      () => 0,
    );
    const error = new TypeError('x');

    await record(error, { kind: 'render', route: '/(tabs)/journal' });
    await record(error, { kind: 'render', route: '/(tabs)' });
    await record(error, { kind: 'fatal' });

    expect(recorded.map((entry) => entry.route)).toEqual(['/(tabs)/journal']);
  });

  it('records a new failure of the same screen, and every failure without an error object', async () => {
    const recorded: ErrorEntry[] = [];
    const record = createErrorRecorder(
      { record: async (entry) => void recorded.push(entry) },
      () => 0,
    );

    await record(new TypeError('x'), { kind: 'render', route: '/(tabs)/journal' });
    await record(new TypeError('x'), { kind: 'render', route: '/(tabs)/journal' });
    await record(undefined, { kind: 'storage-failure', code: 'key-unavailable' });
    await record(undefined, { kind: 'storage-failure', code: 'key-unavailable' });

    expect(recorded).toHaveLength(4);
  });
});

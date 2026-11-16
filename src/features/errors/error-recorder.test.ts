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
});

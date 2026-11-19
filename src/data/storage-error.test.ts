import { attempt } from '@/data/storage-error';
import { err, ok } from '@/domain/result';

describe('attempt', () => {
  it('passes the result of the task on', async () => {
    expect(await attempt(async () => ok(1))).toEqual(ok(1));
    expect(await attempt(async () => err('not-found'))).toEqual(err('not-found'));
  });

  it('reports a thrown error as a storage failure', async () => {
    expect(await attempt(() => Promise.reject(new Error('disk')))).toEqual(err('storage-failed'));
  });
});

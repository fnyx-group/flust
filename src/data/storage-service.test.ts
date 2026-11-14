import { DATABASE_NAME } from '@/data/storage-deps';
import { createStorageService } from '@/data/storage-service';
import { ok } from '@/domain/result';
import { unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';

describe('storage service', () => {
  it('shares one open between concurrent calls, so a first launch creates a single key', async () => {
    const fake = createFakeStorage();
    const service = createStorageService(fake.deps);

    const [first, second] = await Promise.all([service.open(), service.open()]);

    expect(first).toBe(second);
    expect(fake.randomBytes.calls).toBe(1);
    expect(fake.disk.stored.get(DATABASE_NAME)?.key).toBe(fake.keyStore.value);
  });

  it('opens again once the previous open has settled', async () => {
    const fake = createFakeStorage();
    fake.keyStore.failGet = true;
    const service = createStorageService(fake.deps);
    expect((await service.open()).ok).toBe(false);

    fake.keyStore.failGet = false;

    expect((await service.open()).ok).toBe(true);
  });

  it('resets storage', async () => {
    const fake = createFakeStorage();
    const service = createStorageService(fake.deps);
    await unwrap(await service.open()).close();

    expect(await service.reset()).toEqual(ok(undefined));
    expect(fake.disk.stored.size).toBe(0);
  });
});

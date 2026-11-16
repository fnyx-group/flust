import { createLaunchGuard, SAFE_MODE_AFTER, type TextFile } from '@/data/launch-guard';

type FakeTextFile = TextFile & {
  text: string | null;
  failRead: boolean;
  failWrite: boolean;
  failRemove: boolean;
};

function createFakeTextFile(text: string | null = null): FakeTextFile {
  return {
    text,
    failRead: false,
    failWrite: false,
    failRemove: false,
    async read() {
      if (this.failRead) throw new Error('Unreadable');
      return this.text;
    },
    async write(next) {
      if (this.failWrite) throw new Error('Disk full');
      this.text = next;
    },
    async remove() {
      if (this.failRemove) throw new Error('Busy');
      this.text = null;
    },
  };
}

describe('createLaunchGuard', () => {
  it('opens normally and counts the launch until a first screen shows', async () => {
    const file = createFakeTextFile();
    const guard = createLaunchGuard(file);

    expect(await guard.begin()).toBe('normal');
    expect(file.text).toBe('1');

    expect(await guard.finish()).toBe(true);
    expect(file.text).toBeNull();
  });

  it('opens safe mode after two launches in a row that never reached a first screen', async () => {
    const file = createFakeTextFile();

    expect(await createLaunchGuard(file).begin()).toBe('normal');
    expect(await createLaunchGuard(file).begin()).toBe('normal');
    expect(file.text).toBe(String(SAFE_MODE_AFTER));
    expect(await createLaunchGuard(file).begin()).toBe('safe-mode');
    expect(file.text).toBe(String(SAFE_MODE_AFTER));
  });

  it('starts counting again once a launch finishes', async () => {
    const file = createFakeTextFile('1');
    const guard = createLaunchGuard(file);

    await guard.begin();
    await guard.finish();

    expect(await createLaunchGuard(file).begin()).toBe('normal');
  });

  it.each([['garbage'], ['-3'], ['1e9'], ['']])(
    'reads a counter of %p as no failed launch',
    async (text) => {
      const file = createFakeTextFile(text);

      expect(await createLaunchGuard(file).begin()).toBe('normal');
      expect(file.text).toBe('1');
    },
  );

  it('never traps the app in safe mode when the file cannot be read or written', async () => {
    const file = createFakeTextFile('5');
    file.failRead = true;
    file.failWrite = true;
    file.failRemove = true;
    const guard = createLaunchGuard(file);

    expect(await guard.begin()).toBe('normal');
    expect(await guard.finish()).toBe(false);
  });

  it('sets the counter to zero when it cannot be removed, so the next launch opens normally', async () => {
    const file = createFakeTextFile(String(SAFE_MODE_AFTER));
    file.failRemove = true;

    expect(await createLaunchGuard(file).finish()).toBe(true);
    expect(await createLaunchGuard(file).begin()).toBe('normal');
  });
});

import { createLaunchGuard, type TextFile } from '@/data/launch-guard';
import { createLaunchSession } from '@/features/errors/launch-session';
import { createErasedNotice } from '@/features/storage/erase-flow';

function createMemoryFile(): TextFile {
  let text: string | null = null;
  return {
    read: async () => text,
    write: async (next) => {
      text = next;
    },
    remove: async () => {
      text = null;
    },
  };
}

function launch(file: TextFile) {
  const events: string[] = [];
  const session = createLaunchSession({
    guard: createLaunchGuard(file),
    hideSplash: () => void events.push('hide splash'),
    erasedNotice: createErasedNotice(),
  });
  return { events, session };
}

async function failedLaunches(file: TextFile, count: number) {
  for (let attempt = 0; attempt < count; attempt += 1) await launch(file).session.begin();
}

describe('createLaunchSession', () => {
  it('opens safe mode after two launches that never showed a first screen', async () => {
    const file = createMemoryFile();
    await failedLaunches(file, 2);

    expect(await launch(file).session.begin()).toBe('safe-mode');
  });

  it('opens safe mode again when the app fails after leaving it, since leaving counts no launch', async () => {
    const file = createMemoryFile();
    await failedLaunches(file, 2);
    await launch(file).session.begin();

    expect(await launch(file).session.begin()).toBe('safe-mode');
  });

  it('starts normally on the next launch once a first screen shows after leaving safe mode', async () => {
    const file = createMemoryFile();
    await failedLaunches(file, 2);
    const { events, session } = launch(file);
    await session.begin();

    session.firstScreenShown();
    session.firstScreenShown();
    await Promise.resolve();

    expect(events).toEqual(['hide splash', 'hide splash']);
    expect(await launch(file).session.begin()).toBe('normal');
  });

  it('announces the erase on the welcome screen after erasing from safe mode', () => {
    const { session } = launch(createMemoryFile());

    expect(session.erasedFromSafeMode()).toBe('normal');
    expect(session.erasedNotice.take()).toBe(true);
    expect(session.erasedNotice.take()).toBe(false);
  });
});

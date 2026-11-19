import { err, ok } from '@/domain/result';
import { createErasedNotice, createEraseFlow } from '@/features/storage/erase-flow';

function setUp(
  resets: ('ok' | 'fail')[],
  clearReminders: 'ok' | 'fail' = 'ok',
  diagnostics: ('ok' | 'fail')[] = [],
  throws: ('language' | 'pause' | 'diagnostics')[] = [],
) {
  const events: string[] = [];
  const flow = createEraseFlow({
    reset: async () => {
      events.push('reset');
      return resets.shift() === 'fail' ? err('reset-failed') : ok(undefined);
    },
    applyDeviceLanguage: async () => {
      events.push('device language');
      if (throws.includes('language')) throw new Error('i18n unavailable');
    },
    pauseReminders: async () => {
      events.push('pause');
      if (throws.includes('pause')) throw new Error('sync stuck');
      return () => void events.push('resume');
    },
    clearReminders: async () => {
      events.push('reminders');
      if (clearReminders === 'fail') throw new Error('notifications unavailable');
    },
    eraseDiagnostics: async () => {
      events.push('diagnostics');
      if (throws.includes('diagnostics')) throw new Error('file system unavailable');
      return diagnostics.shift() !== 'fail';
    },
    pauseDiagnostics: () => {
      events.push('pause log');
      return () => void events.push('resume log');
    },
    show: (step) => void events.push(step),
  });
  const storage = { close: async () => void events.push('close') };
  return { events, flow, storage };
}

describe('createEraseFlow', () => {
  it('hides every screen, pauses and cancels reminders, erases, cancels them again, then reopens', async () => {
    const { events, flow, storage } = setUp(['ok']);

    await flow.eraseAll(storage);
    expect(events).toEqual([
      'pause log',
      'erasing',
      'pause',
      'reminders',
      'close',
      'reset',
      'reminders',
      'diagnostics',
      'device language',
      'erased',
      'resume',
      'resume log',
    ]);
  });

  it('still shows the end of the erase when the device language cannot be applied', async () => {
    const { events, flow, storage } = setUp(['ok'], 'ok', [], ['language']);

    await flow.eraseAll(storage);
    expect(events.slice(-4)).toEqual(['device language', 'erased', 'resume', 'resume log']);
  });

  it.each(['pause', 'diagnostics'] as const)(
    'shows the failure, never "erasing" for good, when a step throws (%s)',
    async (step) => {
      const { events, flow, storage } = setUp(['ok'], 'ok', [], [step]);

      await flow.eraseAll(storage);
      expect(events).toContain('erase-failed');
      expect(events).not.toContain('erased');
      expect(events.at(-1)).toBe('resume log');
    },
  );

  it('still erases when reminders cannot be cancelled', async () => {
    const { events, flow, storage } = setUp(['ok'], 'fail');

    await flow.eraseAll(storage);
    expect(events).toContain('erased');
  });

  it('shows the failure and keeps the language when erasing fails', async () => {
    const { events, flow, storage } = setUp(['fail']);

    await flow.eraseAll(storage);
    expect(events).toEqual([
      'pause log',
      'erasing',
      'pause',
      'reminders',
      'close',
      'reset',
      'reminders',
      'erase-failed',
      'resume',
      'resume log',
    ]);
  });

  it('erases again without storage on retry, and never opens what is left', async () => {
    const { events, flow, storage } = setUp(['fail', 'ok']);
    await flow.eraseAll(storage);
    events.length = 0;

    await flow.eraseWithoutStorage();
    expect(events).toEqual([
      'pause log',
      'erasing',
      'pause',
      'reminders',
      'reset',
      'reminders',
      'diagnostics',
      'device language',
      'erased',
      'resume',
      'resume log',
    ]);
  });

  it('shows the failure when the error log or the launch counter cannot be erased', async () => {
    const { events, flow, storage } = setUp(['ok', 'ok'], 'ok', ['fail']);

    await flow.eraseAll(storage);
    expect(events).toContain('erase-failed');
    expect(events).not.toContain('erased');

    events.length = 0;
    await flow.eraseWithoutStorage();
    expect(events).toEqual([
      'pause log',
      'erasing',
      'pause',
      'reminders',
      'reset',
      'reminders',
      'diagnostics',
      'device language',
      'erased',
      'resume',
      'resume log',
    ]);
  });

  it('never erases the error log when the data could not be erased', async () => {
    const { events, flow, storage } = setUp(['fail']);

    await flow.eraseAll(storage);
    expect(events).not.toContain('diagnostics');
  });

  it('ignores a second request while one runs', async () => {
    const { events, flow, storage } = setUp(['ok', 'ok']);

    await Promise.all([flow.eraseAll(storage), flow.eraseWithoutStorage()]);
    expect(events.filter((event) => event === 'reset')).toHaveLength(1);
  });

  it('can run again once the previous one is done', async () => {
    const { events, flow } = setUp(['fail', 'fail']);

    await flow.eraseWithoutStorage();
    await flow.eraseWithoutStorage();
    expect(events.filter((event) => event === 'reset')).toHaveLength(2);
  });
});

describe('createErasedNotice', () => {
  it('is taken once after each erase', () => {
    const notice = createErasedNotice();
    expect(notice.take()).toBe(false);
    notice.mark();
    expect(notice.take()).toBe(true);
    expect(notice.take()).toBe(false);
  });
});

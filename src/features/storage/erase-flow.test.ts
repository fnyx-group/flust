import { err, ok } from '@/domain/result';
import { createErasedNotice, createEraseFlow } from '@/features/storage/erase-flow';

function setUp(resets: ('ok' | 'fail')[], clearReminders: 'ok' | 'fail' = 'ok') {
  const events: string[] = [];
  const flow = createEraseFlow({
    reset: async () => {
      events.push('reset');
      return resets.shift() === 'fail' ? err('reset-failed') : ok(undefined);
    },
    applyDeviceLanguage: async () => void events.push('device language'),
    clearReminders: async () => {
      events.push('reminders');
      if (clearReminders === 'fail') throw new Error('notifications unavailable');
    },
    show: (step) => void events.push(step),
  });
  const storage = { close: async () => void events.push('close') };
  return { events, flow, storage };
}

describe('createEraseFlow', () => {
  it('hides every screen, cancels reminders, closes, erases, goes back to the device language, then reopens', async () => {
    const { events, flow, storage } = setUp(['ok']);

    await flow.eraseAll(storage);
    expect(events).toEqual(['erasing', 'reminders', 'close', 'reset', 'device language', 'erased']);
  });

  it('still erases when reminders cannot be cancelled', async () => {
    const { events, flow, storage } = setUp(['ok'], 'fail');

    await flow.eraseAll(storage);
    expect(events).toContain('erased');
  });

  it('shows the failure and keeps the language when erasing fails', async () => {
    const { events, flow, storage } = setUp(['fail']);

    await flow.eraseAll(storage);
    expect(events).toEqual(['erasing', 'reminders', 'close', 'reset', 'erase-failed']);
  });

  it('erases again on retry, and never opens what is left', async () => {
    const { events, flow, storage } = setUp(['fail', 'ok']);
    await flow.eraseAll(storage);
    events.length = 0;

    await flow.retry();
    expect(events).toEqual(['erasing', 'reminders', 'reset', 'device language', 'erased']);
  });

  it('ignores a second request while one runs', async () => {
    const { events, flow, storage } = setUp(['ok', 'ok']);

    await Promise.all([flow.eraseAll(storage), flow.retry()]);
    expect(events.filter((event) => event === 'reset')).toHaveLength(1);
  });

  it('can run again once the previous one is done', async () => {
    const { events, flow } = setUp(['fail', 'fail']);

    await flow.retry();
    await flow.retry();
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

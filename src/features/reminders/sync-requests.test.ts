import {
  onReminderSyncIdle,
  pauseReminderSync,
  reminderSyncPaused,
} from '@/features/reminders/sync-requests';

describe('pauseReminderSync', () => {
  it('pauses at once, waits for the plan being made, and resumes once', async () => {
    let finish: () => void = () => undefined;
    const running = new Promise<void>((done) => {
      finish = done;
    });
    const stop = onReminderSyncIdle(() => running);

    let paused = false;
    const pausing = pauseReminderSync().then((resume) => {
      paused = true;
      return resume;
    });
    expect(reminderSyncPaused()).toBe(true);
    await new Promise((done) => setTimeout(done, 0));
    expect(paused).toBe(false);

    finish();
    const resume = await pausing;
    resume();
    resume();
    expect(reminderSyncPaused()).toBe(false);
    stop();
  });

  it('stays paused until every pause has resumed', async () => {
    const first = await pauseReminderSync();
    const second = await pauseReminderSync();
    first();
    expect(reminderSyncPaused()).toBe(true);
    second();
    expect(reminderSyncPaused()).toBe(false);
  });
});

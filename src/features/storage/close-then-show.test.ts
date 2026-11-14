import { closeThenShow } from '@/features/storage/close-then-show';

describe('closeThenShow', () => {
  it('shows the failure only once storage is closed', async () => {
    const events: string[] = [];
    let finishClosing = () => {};
    const closing = new Promise<void>((resolve) => {
      finishClosing = resolve;
    });
    const storage = {
      close: () => {
        events.push('close');
        return closing;
      },
    };

    const done = closeThenShow(storage, 'journey-corrupted', (failure) => events.push(failure));
    await Promise.resolve();
    expect(events).toEqual(['close']);

    finishClosing();
    await done;
    expect(events).toEqual(['close', 'journey-corrupted']);
  });

  it('still shows the failure when closing fails', async () => {
    const show = jest.fn();
    const storage = { close: () => Promise.reject(new Error('already closed')) };

    await closeThenShow(storage, 'storage-failed', show);
    expect(show).toHaveBeenCalledWith('storage-failed');
  });
});

import { openHelp } from '@/features/help/open-help';

describe('openHelp', () => {
  it('reports an address that opened', async () => {
    const open = jest.fn().mockResolvedValue(true);
    await expect(openHelp(open, 'tel:3114')).resolves.toBe('opened');
    expect(open).toHaveBeenCalledWith('tel:3114');
  });

  it('reports a failure without throwing, as on a device without a phone app', async () => {
    await expect(openHelp(() => Promise.reject(new Error('no handler')), 'tel:3114')).resolves.toBe(
      'failed',
    );
  });

  it('reports a failure thrown before any promise', async () => {
    const open = () => {
      throw new Error('invalid');
    };
    await expect(openHelp(open, 'sms:988')).resolves.toBe('failed');
  });
});

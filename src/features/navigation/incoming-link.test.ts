import { redirectIncomingLink } from '@/features/navigation/incoming-link';

describe('incoming links', () => {
  it.each(['/emergency', '/erase', '/note/12', 'flust://emergency', ''])(
    'open home when they launch the app (%s)',
    (path) => {
      expect(redirectIncomingLink({ path, initial: true })).toBe('/');
    },
  );

  it.each(['/emergency', '/check-in', '/'])('are ignored while the app runs (%s)', (path) => {
    expect(redirectIncomingLink({ path, initial: false })).toBeNull();
  });
});

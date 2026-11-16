import { displayUrl } from '@/features/shared/display-url';

describe('displayUrl', () => {
  it('drops the scheme and the trailing slash', () => {
    expect(displayUrl('https://fnyx-group.org/flust')).toBe('fnyx-group.org/flust');
    expect(displayUrl('https://findahelpline.com/')).toBe('findahelpline.com');
  });
});

import { err, ok } from '@/domain/result';
import { chooseLanguage } from '@/features/settings/language-choice';

describe('chooseLanguage', () => {
  it('stores the choice before applying it', async () => {
    const events: string[] = [];
    const outcome = await chooseLanguage(
      {
        save: async (preference) => {
          events.push(`save ${preference}`);
          return ok(undefined);
        },
        apply: async (preference) => void events.push(`apply ${preference}`),
        isLatest: () => true,
      },
      'fr',
    );

    expect(outcome).toBe('applied');
    expect(events).toEqual(['save fr', 'apply fr']);
  });

  it('changes nothing when storing fails', async () => {
    const apply = jest.fn();
    const outcome = await chooseLanguage(
      { save: async () => err('storage-failed'), apply, isLatest: () => true },
      'device',
    );

    expect(outcome).toBe('save-failed');
    expect(apply).not.toHaveBeenCalled();
  });

  it('ignores a choice overtaken by a newer one, stored or not', async () => {
    const apply = jest.fn();
    const stale = { apply, isLatest: () => false };

    expect(await chooseLanguage({ ...stale, save: async () => ok(undefined) }, 'en')).toBe(
      'superseded',
    );
    expect(await chooseLanguage({ ...stale, save: async () => err('storage-failed') }, 'en')).toBe(
      'superseded',
    );
    expect(apply).not.toHaveBeenCalled();
  });
});

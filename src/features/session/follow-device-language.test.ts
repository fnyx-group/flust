import { err, ok } from '@/domain/result';
import { followDeviceLanguage } from '@/features/session/follow-device-language';
import type { Language } from '@/lib/i18n/language';

function switchFrom(language: Language) {
  const changes: Language[] = [];
  return {
    changes,
    i18n: {
      language,
      changeLanguage: async (next: Language) => void changes.push(next),
    },
  };
}

const stored = (value: string | null) => ({ loadLanguage: async () => ok(value) });

describe('followDeviceLanguage', () => {
  it('follows the phone when the device language is chosen', async () => {
    const { changes, i18n } = switchFrom('en');
    await followDeviceLanguage(stored('device'), 'fr', i18n);
    expect(changes).toEqual(['fr']);
  });

  it('follows the phone when nothing is stored', async () => {
    const { changes, i18n } = switchFrom('en');
    await followDeviceLanguage(stored(null), 'fr', i18n);
    expect(changes).toEqual(['fr']);
  });

  it('keeps a chosen language whatever the phone uses', async () => {
    const { changes, i18n } = switchFrom('en');
    await followDeviceLanguage(stored('en'), 'fr', i18n);
    expect(changes).toEqual([]);
  });

  it('does nothing when the language already matches', async () => {
    const { changes, i18n } = switchFrom('fr');
    await followDeviceLanguage(stored('device'), 'fr', i18n);
    expect(changes).toEqual([]);
  });

  it('changes nothing when the setting cannot be read', async () => {
    const { changes, i18n } = switchFrom('en');
    await followDeviceLanguage({ loadLanguage: async () => err('storage-failed') }, 'fr', i18n);
    expect(changes).toEqual([]);
  });
});

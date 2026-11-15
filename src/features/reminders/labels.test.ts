import { DEFAULT_REMINDER_SETTINGS, REMINDER_KINDS } from '@/domain/reminders';
import {
  formatReminderTime,
  notificationLabels,
  notificationText,
  remindersValue,
  wheelRowLabels,
} from '@/features/reminders/labels';
import { createI18n } from '@/lib/i18n';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

const english = createI18n('en').t;
const french = createI18n('fr').t;

describe('notificationText', () => {
  it('has neutral text for every reminder, with French spacing', () => {
    for (const kind of REMINDER_KINDS) {
      expect(notificationText(english, kind)).not.toMatch(/porn|relapse|lapse|urge|addict/i);
      expect(notificationText(french, kind)).not.toMatch(/porno|rechute|craquage|envie|addict/i);
    }
    expect(notificationText(french, 'check-in')).toBe("Comment s'est passée ta journée\u202f?");
    expect(notificationText(english, 'return')).toBe(
      'flust is here whenever you like, no pressure.',
    );
  });

  it('names the channel and the hidden preview in each language', () => {
    expect(notificationLabels(french)).toMatchObject({
      channelName: 'Rappels',
      previewPlaceholder: 'Rappel',
    });
    expect(notificationLabels(english)).toMatchObject({
      channelName: 'Reminders',
      previewPlaceholder: 'Reminder',
    });
  });
});

describe('formatReminderTime', () => {
  it('follows the 12 or 24 hour setting, whatever the time zone', () => {
    expect(formatReminderTime('fr', 21 * 60, false)).toBe('21:00');
    expect(formatReminderTime('en', 8 * 60 + 5, false)).toBe('08:05');
    expect(formatReminderTime('en', 21 * 60, true)).toMatch(/^9:00\sPM$/);
  });
});

describe('wheelRowLabels', () => {
  it('lists the hours as the clock shows them, and the minutes on two digits', () => {
    const clock24 = wheelRowLabels('fr', false);
    expect(clock24.hours.slice(0, 3)).toEqual(['00', '01', '02']);
    expect(clock24.hours.at(-1)).toBe('23');
    expect(clock24.minutes.slice(0, 3)).toEqual(['00', '05', '10']);

    const clock12 = wheelRowLabels('en', true);
    expect(clock12.hours.slice(0, 3)).toEqual(['12', '1', '2']);
    expect(clock12.periods).toEqual(['AM', 'PM']);
  });
});

describe('remindersValue', () => {
  const on = { on: true, minute: 21 * 60 };

  it('shows the check-in time, then the thought time, then nothing, then off', () => {
    expect(
      remindersValue(english, { ...DEFAULT_REMINDER_SETTINGS, checkIn: on }, 'en', false),
    ).toBe('21:00');
    expect(
      remindersValue(
        english,
        { ...DEFAULT_REMINDER_SETTINGS, thought: { on: true, minute: 480 } },
        'en',
        false,
      ),
    ).toBe('08:00');
    expect(
      remindersValue(english, { ...DEFAULT_REMINDER_SETTINGS, ranks: true }, 'en', false),
    ).toBeUndefined();
    expect(remindersValue(french, DEFAULT_REMINDER_SETTINGS, 'fr', false)).toBe('Désactivés');
  });
});

describe('risk hours hint', () => {
  it('names the two timed moments as the profile shows them', () => {
    const hint = french('reminders.riskHours.unavailable', {
      night: french('presets.riskMoments.in-bed-at-night'),
      weekend: french('presets.riskMoments.weekend'),
    });
    expect(hint).toContain('« Le soir au lit »');
    expect(hint).toContain('« Le week-end »');
  });
});

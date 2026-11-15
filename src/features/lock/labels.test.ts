import { LOCK_DELAYS } from '@/domain/lock';
import { MS_PER_MINUTE, MS_PER_SECOND } from '@/domain/time';
import { delayLabel, lockToggleLabel, lockValue, waitLabel } from '@/features/lock/labels';
import { createI18n } from '@/lib/i18n';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

const english = createI18n('en').t;
const french = createI18n('fr').t;

const face = { kind: 'biometric', biometric: 'face' } as const;
const fingerprint = { kind: 'biometric', biometric: 'fingerprint' } as const;
const passcode = { kind: 'passcode' } as const;
const none = { kind: 'none' } as const;

describe('lockToggleLabel', () => {
  it("uses Apple's names on iOS and plain words on Android", () => {
    expect(lockToggleLabel(english, face, 'ios')).toBe('Lock with Face ID');
    expect(lockToggleLabel(french, fingerprint, 'ios')).toBe('Verrouiller avec Touch ID');
    expect(lockToggleLabel(french, fingerprint, 'android')).toBe("Verrouiller avec l'empreinte");
    expect(lockToggleLabel(english, passcode, 'android')).toBe('Lock with passcode');
    expect(lockToggleLabel(english, none, 'ios')).toBe('Lock flust');
  });

  it('names no method when the device could not be read', () => {
    expect(lockToggleLabel(english, { kind: 'unknown' }, 'ios')).toBe('Lock flust');
  });
});

describe('lockValue', () => {
  it('says off, paused or the method', () => {
    expect(lockValue(english, { enabled: false, delay: 0 }, face, 'ios')).toBe('Off');
    expect(lockValue(french, { enabled: true, delay: 0 }, none, 'android')).toBe('En pause');
    expect(lockValue(english, { enabled: true, delay: 0 }, face, 'ios')).toBe('Face ID');
    expect(lockValue(english, { enabled: true, delay: 0 }, face, 'android')).toBe('Face');
  });

  it('never reads as paused when the device could not be read', () => {
    expect(lockValue(english, { enabled: true, delay: 0 }, { kind: 'unknown' }, 'ios')).toBe(
      'Passcode',
    );
  });
});

describe('delayLabel', () => {
  it('names every delay offered', () => {
    for (const delay of LOCK_DELAYS) {
      expect(delayLabel(french, delay)).not.toBe('');
      expect(delayLabel(english, delay)).not.toBe('');
    }
    expect(delayLabel(french, MS_PER_MINUTE)).toBe('Après 1 min');
    expect(delayLabel(english, 2 * MS_PER_MINUTE)).toBe('');
  });
});

describe('waitLabel', () => {
  it('counts seconds under a minute, then minutes rounded up', () => {
    expect(waitLabel(french, 29_500)).toBe('Nouvel essai possible dans 30 s.');
    expect(waitLabel(english, MS_PER_MINUTE + MS_PER_SECOND)).toBe('You can try again in 2 min.');
    expect(waitLabel(english, 15 * MS_PER_MINUTE)).toBe('You can try again in 15 min.');
  });
});

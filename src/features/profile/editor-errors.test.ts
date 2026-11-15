import {
  planErrorMessage,
  planRemoveError,
  planSaveError,
  reasonErrorMessage,
  reasonSaveError,
} from '@/features/profile/editor-errors';
import { createI18n } from '@/lib/i18n';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

const english = createI18n('en').t;
const french = createI18n('fr').t;

describe('editor errors', () => {
  it('tell a failed save from a failed removal', () => {
    expect(reasonSaveError('storage-failed')).toBe('save-failed');
    expect(reasonSaveError('same-reason')).toBe('same-reason');
    expect(planSaveError('storage-failed')).toBe('save-failed');
    expect(planSaveError('too-many-plans')).toBe('too-many-plans');
    expect(planRemoveError('storage-failed')).toBe('remove-failed');
    expect(planRemoveError('last-plan')).toBe('last-plan');
  });

  it('say how many reasons and plans there already are when the limit is reached', () => {
    expect(reasonErrorMessage(english, 'too-many-reasons')).toBe(
      'You already have 10 reasons. Remove one to add another.',
    );
    expect(planErrorMessage(english, 'too-many-plans')).toBe(
      'You already have 5 plans. Delete one to add another.',
    );
    expect(planErrorMessage(french, 'too-many-plans')).toBe(
      'Tu as déjà 5 plans. Supprimes-en un pour en ajouter un autre.',
    );
  });

  it('explain why the last plan stays', () => {
    expect(planErrorMessage(english, 'last-plan')).toBe(
      'Keep at least one plan: the emergency screen always has one to show you.',
    );
  });

  it('have a message for every other error', () => {
    for (const error of ['same-reason', 'not-found', 'save-failed', 'remove-failed'] as const) {
      expect(reasonErrorMessage(english, error)).not.toContain('profile.');
    }
    for (const error of ['same-plan', 'not-found', 'save-failed', 'remove-failed'] as const) {
      expect(planErrorMessage(english, error)).not.toContain('profile.');
    }
  });
});

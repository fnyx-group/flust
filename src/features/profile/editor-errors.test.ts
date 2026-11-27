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

  it('give the limit on reasons and plans when it is reached', () => {
    expect(reasonErrorMessage(english, 'too-many-reasons')).toBe(
      '10 reasons at most. Remove one first.',
    );
    expect(planErrorMessage(english, 'too-many-plans')).toBe('5 plans at most. Delete one first.');
    expect(planErrorMessage(french, 'too-many-plans')).toBe(
      "5 plans au plus. Supprimes-en un d'abord.",
    );
  });

  it('ask to keep the last plan', () => {
    expect(planErrorMessage(english, 'last-plan')).toBe('Keep at least one plan.');
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

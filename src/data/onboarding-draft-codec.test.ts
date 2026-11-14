import { decodeDraft, encodeDraft } from '@/data/onboarding-draft-codec';
import { EMPTY_DRAFT, type OnboardingDraft } from '@/domain/onboarding';

function decodeAnswers(answers: unknown) {
  return decodeDraft('reasons', JSON.stringify(answers)).answers;
}

describe('draft codec', () => {
  it('round trips a full draft', () => {
    const draft = {
      step: 'start',
      answers: {
        reasons: [
          { kind: 'preset', id: 'focus' },
          { kind: 'custom', text: 'Mine' },
        ],
        riskMoments: ['boredom'],
        plan: { trigger: 'urge', action: { kind: 'preset', id: 'walk-ten-minutes' } },
        start: { kind: 'past', at: 1_700_000_000_000 },
      },
    } as OnboardingDraft;
    const { step, answers } = encodeDraft(draft);
    expect(decodeDraft(step, answers)).toEqual(draft);
  });

  it('falls back to the welcome step for an unknown step', () => {
    expect(decodeDraft('lock', '{}').step).toBe('welcome');
    expect(decodeDraft(null, '{}').step).toBe('welcome');
  });

  it.each([
    ['unreadable JSON', '{'],
    ['an array', '[]'],
    ['null', 'null'],
  ])('falls back to empty answers for %s', (_, answers) => {
    expect(decodeDraft('plan', answers)).toEqual({ ...EMPTY_DRAFT, step: 'plan' });
  });

  it('falls back to empty answers when they are not text', () => {
    expect(decodeDraft('plan', 42).answers).toEqual(EMPTY_DRAFT.answers);
  });

  it('drops unknown, duplicate and invalid reasons, and keeps one custom reason last', () => {
    expect(
      decodeAnswers({
        reasons: [
          { kind: 'custom', text: 'First' },
          { kind: 'preset', id: 'sleep' },
          { kind: 'preset', id: 'sleep' },
          { kind: 'preset', id: 'unknown' },
          { kind: 'custom', text: '   ' },
          { kind: 'custom', text: 3 },
          { kind: 'other' },
          'sleep',
          null,
        ],
      }).reasons,
    ).toEqual([
      { kind: 'preset', id: 'sleep' },
      { kind: 'custom', text: 'First' },
    ]);
  });

  it('drops unknown risk moments', () => {
    expect(decodeAnswers({ riskMoments: ['stress', 'urge', 7] }).riskMoments).toEqual(['stress']);
    expect(decodeAnswers({ riskMoments: 'stress' }).riskMoments).toEqual([]);
  });

  it('keeps each risk moment once, in preset order', () => {
    expect(
      decodeAnswers({ riskMoments: ['weekend', 'stress', 'stress', 'weekend'] }).riskMoments,
    ).toEqual(['stress', 'weekend']);
  });

  it.each([
    ['an unknown trigger', { trigger: 'rain', action: { kind: 'preset', id: 'guided-breathing' } }],
    ['an unknown action', { trigger: 'urge', action: { kind: 'preset', id: 'sing' } }],
    ['an empty custom action', { trigger: 'urge', action: { kind: 'custom', text: '' } }],
    ['a missing action', { trigger: 'urge' }],
    ['a plan that is not an object', 'urge'],
  ])('drops a plan with %s', (_, plan) => {
    expect(decodeAnswers({ plan }).plan).toBeNull();
  });

  it('keeps a custom action', () => {
    expect(
      decodeAnswers({ plan: { trigger: 'weekend', action: { kind: 'custom', text: ' Run ' } } })
        .plan,
    ).toEqual({ trigger: 'weekend', action: { kind: 'custom', text: 'Run' } });
  });

  it.each([
    ['an invalid timestamp', { kind: 'past', at: -1 }],
    ['a missing timestamp', { kind: 'past' }],
    ['an unknown kind', { kind: 'later', at: 0 }],
    ['a value that is not an object', 'now'],
  ])('starts now for %s', (_, start) => {
    expect(decodeAnswers({ start }).start).toEqual({ kind: 'now' });
  });
});

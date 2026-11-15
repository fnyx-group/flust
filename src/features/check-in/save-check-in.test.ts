import type { CheckInRepository } from '@/data/check-in-repository';
import { CHECK_IN_NOTE_MAX_LENGTH, type CheckIn } from '@/domain/check-in';
import { localDayNumber } from '@/domain/local-time';
import { err, ok } from '@/domain/result';
import {
  draftOf,
  EMPTY_DRAFT,
  isComplete,
  saveCheckIn,
  type CompleteDraft,
} from '@/features/check-in/save-check-in';
import { zoneOffsetAt } from '@test/zones';

const paris = zoneOffsetAt('Europe/Paris');
const draft: CompleteDraft = { mood: 2, urge: 'light', context: ['stress'], note: '  Tired. ' };

function repository(result: Awaited<ReturnType<CheckInRepository['save']>> | null = null) {
  const save = jest.fn<
    ReturnType<CheckInRepository['save']>,
    Parameters<CheckInRepository['save']>
  >(async (day, at, answers) => result ?? ok({ ...answers, day, recordedAt: at, updatedAt: at }));
  return { save };
}

describe('saveCheckIn', () => {
  it('saves to the local day of the time of saving, with the note trimmed', async () => {
    const now = Date.UTC(2026, 10, 14, 22, 30);
    const checkIns = repository();

    const saved = await saveCheckIn(checkIns, draft, now, paris);
    const day = localDayNumber(now, paris);
    expect(saved).toEqual(ok({ day, recordedAt: now, updatedAt: now, ...draft, note: 'Tired.' }));
    expect(checkIns.save).toHaveBeenCalledWith(day, now, {
      mood: 2,
      urge: 'light',
      context: ['stress'],
      note: 'Tired.',
    });
  });

  it('saves a screen left open past local midnight to the new day', async () => {
    const beforeMidnight = Date.UTC(2026, 10, 14, 22, 59);
    const afterMidnight = Date.UTC(2026, 10, 14, 23, 1);
    const checkIns = repository();

    await saveCheckIn(checkIns, draft, afterMidnight, paris);
    expect(checkIns.save.mock.calls[0]?.[0]).toBe(localDayNumber(beforeMidnight, paris) + 1);
  });

  it('stores an empty note as no note', async () => {
    const checkIns = repository();
    await saveCheckIn(checkIns, { ...draft, note: ' \n ' }, 0, paris);
    expect(checkIns.save.mock.calls[0]?.[2].note).toBeNull();
  });

  it('refuses a note that is too long without saving', async () => {
    const checkIns = repository();
    const note = 'a'.repeat(CHECK_IN_NOTE_MAX_LENGTH + 1);
    expect(await saveCheckIn(checkIns, { ...draft, note }, 0, paris)).toEqual(err('note-too-long'));
    expect(checkIns.save).not.toHaveBeenCalled();
  });

  it('reports a storage failure', async () => {
    expect(await saveCheckIn(repository(err('storage-failed')), draft, 0, paris)).toEqual(
      err('save-failed'),
    );
  });
});

describe('drafts', () => {
  it('start empty, so no answer is suggested', () => {
    expect(draftOf(null)).toBe(EMPTY_DRAFT);
    expect(isComplete(EMPTY_DRAFT)).toBe(false);
  });

  it('need a mood and an urge level', () => {
    expect(isComplete({ ...EMPTY_DRAFT, mood: 3 })).toBe(false);
    expect(isComplete({ ...EMPTY_DRAFT, urge: 'none' })).toBe(false);
    expect(isComplete({ ...EMPTY_DRAFT, mood: 3, urge: 'none' })).toBe(true);
  });

  it('reload the answers saved today', () => {
    const saved: CheckIn = {
      day: 1,
      recordedAt: 0,
      updatedAt: 0,
      mood: 4,
      urge: 'intense',
      context: ['weekend'],
      note: null,
    };
    expect(draftOf(saved)).toEqual({ mood: 4, urge: 'intense', context: ['weekend'], note: '' });
  });
});

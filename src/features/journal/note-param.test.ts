import { noteTarget } from '@/features/journal/note-param';

describe('noteTarget', () => {
  it('opens a new note without an id', () => {
    expect(noteTarget(undefined)).toEqual({ kind: 'new' });
  });

  it('opens the note of a valid id', () => {
    expect(noteTarget('12')).toEqual({ kind: 'edit', id: 12 });
  });

  it.each([[''], ['0'], ['012'], ['-1'], ['1.5'], ['abc'], ['99999999999999999'], [['1', '2']]])(
    'refuses %j',
    (param) => {
      expect(noteTarget(param)).toEqual({ kind: 'invalid' });
    },
  );
});

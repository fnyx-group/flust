import { entryTarget } from '@/features/profile/entry-param';

describe('entryTarget', () => {
  it('adds an item without an id', () => {
    expect(entryTarget(undefined)).toEqual({ kind: 'new' });
  });

  it('edits the item with the given id', () => {
    expect(entryTarget('12')).toEqual({ kind: 'edit', id: 12 });
  });

  it.each([[''], ['0'], ['-1'], ['1.5'], ['12a'], ['99999999999999999'], [['1', '2']]])(
    'refuses %p',
    (param) => {
      expect(entryTarget(param)).toEqual({ kind: 'invalid' });
    },
  );
});

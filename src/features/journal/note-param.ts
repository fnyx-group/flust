import { toNoteId, type NoteId } from '@/domain/journal';

export type NoteTarget = { kind: 'new' } | { kind: 'edit'; id: NoteId } | { kind: 'invalid' };

// The note route opens a new note without an id, and an existing one with `?id=12`.
export function noteTarget(param: string | string[] | undefined): NoteTarget {
  if (param === undefined) return { kind: 'new' };
  if (typeof param !== 'string' || !/^[1-9][0-9]{0,15}$/.test(param)) return { kind: 'invalid' };
  const id = toNoteId(Number(param));
  return id === null ? { kind: 'invalid' } : { kind: 'edit', id };
}

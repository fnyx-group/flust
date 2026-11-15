import type { JournalRepository } from '@/data/journal-repository';
import {
  parseNoteContent,
  type Note,
  type NoteContentError,
  type NoteDraft,
} from '@/domain/journal';
import { localDayNumber, type UtcOffsetAt } from '@/domain/local-time';
import { err, ok, type Result } from '@/domain/result';
import type { Timestamp } from '@/domain/time';

export type SaveNoteError = NoteContentError | 'note-missing' | 'save-failed';

export const SAVE_NOTE_ERROR_MESSAGES = {
  empty: 'journal.note.errors.empty',
  'title-too-long': 'journal.note.errors.title-too-long',
  'body-too-long': 'journal.note.errors.body-too-long',
  'note-missing': 'journal.note.errors.note-missing',
  'save-failed': 'journal.note.errors.save-failed',
} as const satisfies Record<SaveNoteError, string>;

// A new note takes its local day and UTC offset from the time of its first save; an edit keeps
// them. An edited note that no longer exists is reported apart, since trying again cannot help:
// the text stays on screen and can be saved as a new note.
export async function saveNote(
  journal: Pick<JournalRepository, 'create' | 'update'>,
  existing: Note | null,
  draft: NoteDraft,
  now: Timestamp,
  offsetAt: UtcOffsetAt,
): Promise<Result<Note, SaveNoteError>> {
  const content = parseNoteContent(draft);
  if (!content.ok) return content;
  const saved =
    existing === null
      ? await journal.create(
          { day: localDayNumber(now, offsetAt), at: now, offset: offsetAt(now) },
          content.value,
        )
      : await journal.update(existing.id, now, content.value);
  if (saved.ok) return ok(saved.value);
  return err(saved.error === 'not-found' ? 'note-missing' : 'save-failed');
}

import { dateOfDay, startOfWeek, type Weekday } from '@/domain/local-time';
import { err, ok, type Result } from '@/domain/result';
import { isValidTimestamp, type Timestamp } from '@/domain/time';

declare const noteIdBrand: unique symbol;
declare const titleBrand: unique symbol;
declare const bodyBrand: unique symbol;

export type NoteId = number & { readonly [noteIdBrand]: true };

// On one line, trimmed and within the length limit.
export type NoteTitle = string & { readonly [titleBrand]: true };

// Trimmed, with its line breaks kept, never empty and within the length limit.
export type NoteBody = string & { readonly [bodyBrand]: true };

export const NOTE_TITLE_MAX_LENGTH = 120;
export const NOTE_BODY_MAX_LENGTH = 10_000;

// UTC offsets run from -12:00 to +14:00; the bounds leave room for rules that may change.
const MAX_OFFSET_MINUTES = 18 * 60;

// The text as the note screen holds it, before any normalization.
export type NoteDraft = { readonly title: string; readonly body: string };

export const EMPTY_NOTE_DRAFT: NoteDraft = { title: '', body: '' };

export type NoteContent = { readonly title: NoteTitle | null; readonly body: NoteBody };

// `day` is the local day number at creation and `offset` the UTC offset then, in minutes east of
// UTC. Both are stored, so a note keeps the day and the time it was written at after travel.
export type Note = NoteContent & {
  readonly id: NoteId;
  readonly day: number;
  readonly createdAt: Timestamp;
  readonly offset: number;
  readonly updatedAt: Timestamp;
};

// What the journal list shows: the start of the text rather than all of it.
export type NoteSummary = Pick<Note, 'id' | 'day' | 'createdAt' | 'title'> & {
  readonly excerpt: string;
};

export type NoteContentError = 'empty' | 'title-too-long' | 'body-too-long';

type StoredFields<T> = { readonly [K in keyof T]: unknown };
export type StoredNote = StoredFields<Note>;
export type StoredNoteSummary = StoredFields<NoteSummary>;

function normalizeTitle(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

function normalizeBody(raw: string): string {
  return raw.replace(/\r\n?/g, '\n').trim();
}

// Code points, like CustomText, so a simple emoji counts once.
function codePointLength(text: string): number {
  return [...text].length;
}

// The text is required and the title optional: a note with only a title is empty.
export function parseNoteContent(draft: NoteDraft): Result<NoteContent, NoteContentError> {
  const title = normalizeTitle(draft.title);
  const body = normalizeBody(draft.body);
  if (body.length === 0) return err('empty');
  if (codePointLength(title) > NOTE_TITLE_MAX_LENGTH) return err('title-too-long');
  if (codePointLength(body) > NOTE_BODY_MAX_LENGTH) return err('body-too-long');
  return ok({
    title: title.length === 0 ? null : (title as NoteTitle),
    body: body as NoteBody,
  });
}

export function draftOf(note: Note | null): NoteDraft {
  return note === null ? EMPTY_NOTE_DRAFT : { title: note.title ?? '', body: note.body };
}

// Drafts are compared as they would be saved, so spaces at the ends or a prompt inserted then
// erased are not changes.
export function hasUnsavedChanges(saved: NoteDraft, current: NoteDraft): boolean {
  return (
    normalizeTitle(saved.title) !== normalizeTitle(current.title) ||
    normalizeBody(saved.body) !== normalizeBody(current.body)
  );
}

// A starter goes on a new paragraph after the existing text. It is left out rather than cut when
// the text would go over the limit.
export function insertPrompt(body: string, starter: string): Result<string, 'too-long'> {
  const existing = body.trimEnd();
  const next = existing.length === 0 ? starter : `${existing}\n\n${starter}`;
  return codePointLength(next) > NOTE_BODY_MAX_LENGTH ? err('too-long') : ok(next);
}

export function parseNote(stored: StoredNote): Result<Note, 'invalid-note'> {
  const { id, day, createdAt, offset, updatedAt, title, body } = stored;
  const content = parseStoredContent(title, body);
  if (
    !isNoteId(id) ||
    !isDay(day) ||
    !isTimestamp(createdAt) ||
    !isOffset(offset) ||
    !isTimestamp(updatedAt) ||
    content === null
  ) {
    return err('invalid-note');
  }
  return ok({ id, day, createdAt, offset, updatedAt, ...content });
}

export function parseNoteSummary(stored: StoredNoteSummary): Result<NoteSummary, 'invalid-note'> {
  const { id, day, createdAt, title, excerpt } = stored;
  const parsedTitle = parseStoredTitle(title);
  if (
    !isNoteId(id) ||
    !isDay(day) ||
    !isTimestamp(createdAt) ||
    parsedTitle === undefined ||
    typeof excerpt !== 'string' ||
    normalizeBody(excerpt).length === 0
  ) {
    return err('invalid-note');
  }
  return ok({ id, day, createdAt, title: parsedTitle, excerpt: normalizeBody(excerpt) });
}

// Stored values must already be normalized: one that would change on saving was not written by
// the app.
function parseStoredContent(title: unknown, body: unknown): NoteContent | null {
  if (typeof body !== 'string' || (title !== null && typeof title !== 'string')) return null;
  const parsed = parseNoteContent({ title: title ?? '', body });
  if (!parsed.ok || parsed.value.body !== body || parsed.value.title !== title) return null;
  return parsed.value;
}

// Undefined when the title cannot be valid, since null already means no title.
function parseStoredTitle(value: unknown): NoteTitle | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const title = normalizeTitle(value);
  const valid =
    title.length > 0 && title === value && codePointLength(title) <= NOTE_TITLE_MAX_LENGTH;
  return valid ? (title as NoteTitle) : undefined;
}

export function toNoteId(value: number): NoteId | null {
  return isNoteId(value) ? value : null;
}

function isNoteId(value: unknown): value is NoteId {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isDay(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function isTimestamp(value: unknown): value is Timestamp {
  return typeof value === 'number' && isValidTimestamp(value);
}

function isOffset(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && Math.abs(value) <= MAX_OFFSET_MINUTES
  );
}

export type NoteGroupKey =
  | { readonly kind: 'this-week' }
  | { readonly kind: 'last-week' }
  | { readonly kind: 'month'; readonly year: number; readonly month: number };

export type NoteGroup = { readonly key: NoteGroupKey; readonly notes: readonly NoteSummary[] };

// Notes are grouped by their stored local day, so travel never moves one to another group. The
// week starts on `firstWeekday`, from the device's region. Days after today, left by a clock set
// back, count as this week. Older notes are grouped by calendar month. Notes are ordered by day,
// then by time of creation, newest first: after travel west, a note written later can fall on an
// earlier day, and ordering by time alone would split a group in two.
export function groupNotes(
  notes: readonly NoteSummary[],
  today: number,
  firstWeekday: Weekday,
): NoteGroup[] {
  const thisWeek = startOfWeek(today, firstWeekday);
  const groups: { key: NoteGroupKey; notes: NoteSummary[] }[] = [];
  for (const note of [...notes].sort(newestFirst)) {
    const key = groupKeyOf(note.day, thisWeek);
    const last = groups.at(-1);
    if (last !== undefined && sameGroupKey(last.key, key)) last.notes.push(note);
    else groups.push({ key, notes: [note] });
  }
  return groups;
}

function newestFirst(a: NoteSummary, b: NoteSummary): number {
  return b.day - a.day || b.createdAt - a.createdAt || b.id - a.id;
}

function groupKeyOf(day: number, thisWeek: number): NoteGroupKey {
  if (day >= thisWeek) return { kind: 'this-week' };
  if (day >= thisWeek - 7) return { kind: 'last-week' };
  const { year, month } = dateOfDay(day);
  return { kind: 'month', year, month };
}

function sameGroupKey(a: NoteGroupKey, b: NoteGroupKey): boolean {
  if (a.kind === 'month' && b.kind === 'month') return a.year === b.year && a.month === b.month;
  return a.kind === b.kind;
}

# 0019 Journal notes

## Context

The text journal lets the user write notes with an optional title, edit them and delete them ([Features](../product/features.md#journal)). Notes are listed by recency: this week, last week, then by month. A note must keep the day and the time it was written at when the user travels, and the list must stay smooth with hundreds of notes. Text the user writes is among the most sensitive data in the app.

## Decision

- Migration 5 adds a `journal_note` table: `local_day`, `created_at`, `utc_offset` (minutes east of UTC, within 18 hours), `updated_at`, an optional `title` and a `body` that is never empty. It lives in the SQLCipher database, like every other record.
- `local_day` and `utc_offset` are taken from the time of the first save and stored. They are never recomputed, so a note keeps its day in the list and the time shown on it after a time zone change. Editing a note only moves `updated_at`.
- The text is required and the title optional: a note with only a title is empty and is never saved. Titles are normalized to one line. Titles are limited to 120 code points and texts to 10,000, checked in `src/domain/journal.ts`; the text fields' `maxLength`, in UTF-16 units, keeps typing within them.
- Rows are validated through `parseNote` and `parseNoteSummary` when read. A row that fails is left out of the list and treated as missing when opened. A write whose row cannot be read back is rolled back.
- The list reads the first 280 characters of each text only, in one query ordered by local day, then time of creation. Notes are grouped in `groupNotes`: from the first day of this week, from the first day of last week, then by calendar month. Days after today count as this week. Weeks start on the first weekday of the device's region, from `expo-localization`, not of the app language.
- The list uses a `SectionList` wrapper in `src/ui/scroll-view.tsx`, which turns off the Android stretch effect like `ScrollView`. No list library is added.
- Unsaved changes are found by comparing the draft with the saved note after the same normalization as saving, so spaces at the ends are not changes. `usePreventRemove` catches every way out of the note screen and asks before discarding.
- Unsaved text is kept in memory only. Nothing is written outside the encrypted database before the user saves.

## Consequences

- A note written in Paris late in the evening stays on that day, at that time, after a flight to Tokyo.
- The list is read again each time the journal tab comes into focus. Hundreds of short excerpts make this cheap; paging can come later if needed.
- Statistics can read when notes were written, in local time, without a further migration.
- Text typed before a crash or before the app is killed is lost. An encrypted draft could be added later.
- The video journal of V0.3 will add its own table and the "Tout / Notes / Vidéos" filter.

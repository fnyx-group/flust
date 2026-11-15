# 0019 Journal notes

## Context

The text journal lets the user write notes with an optional title, edit them and delete them ([Features](../product/features.md#journal)). Notes are listed by recency: this week, last week, then by month. A note must keep the day and the time it was written at when the user travels, and the list must stay smooth with hundreds of notes. Text the user writes is among the most sensitive data in the app.

## Decision

- Migration 5 adds a `journal_note` table: `local_day`, `created_at`, `utc_offset` (minutes east of UTC, within 18 hours), `updated_at`, an optional `title` and a `body` that is never empty. It lives in the SQLCipher database, like every other record.
- `local_day` and `utc_offset` are taken from the time of the first save and stored. They are never recomputed, so a note keeps its day in the list and the time shown on it after a time zone change. Editing a note only moves `updated_at`.
- The text is required and the title optional: a note with only a title is empty and is never saved. Titles are normalized to one line. Titles are limited to 120 UTF-16 units and texts to 10,000, checked in `src/domain/journal.ts` with `text.length`. The text fields' `maxLength` counts the same units, so typing stops exactly where saving would refuse, and a starter inserted by a prompt never goes over the field's limit, which Android would cut. An emoji outside the basic plane counts twice.
- Rows are validated through `parseNote` and `parseNoteSummary` when read. A row that fails is left out of the list and shown as unreadable when opened. A write whose row cannot be read back is rolled back. The list checks every column `parseNote` checks, so a listed note always opens: without reading the whole text, it reads its length, its last character and whether it holds a carriage return. SQLite counts that length in code points, which never exceed UTF-16 units, so a text the app wrote always passes; a text over the limit in UTF-16 units only, which the app cannot write, would be listed and then shown as unreadable.
- The database is opened with `PRAGMA secure_delete = ON`, set on the connection the app keeps. A deleted note is overwritten with zeros in the file instead of staying in free pages until they are reused, so it cannot be read back even with the key. Deletes cost a little more writing, which the app's small writes can afford.
- The list reads the first 280 characters of each text only, in one query ordered by local day, then time of creation. Notes are grouped in `groupNotes`: from the first day of this week, from the first day of last week, then by calendar month. Days after today count as this week. Weeks start on the first weekday of the device's region, from `expo-localization`, not of the app language.
- The list uses a `SectionList` wrapper in `src/ui/scroll-view.tsx`, which turns off the Android stretch effect like `ScrollView`. No list library is added.
- Unsaved changes are found by comparing the draft with the saved note after the same normalization as saving, so spaces at the ends are not changes. `usePreventRemove` catches every way out of the note screen and asks before discarding. A new note with only a title is never saved, but leaving it asks first.
- The note, check-in, lapse and onboarding screens share `KeyboardScreen` (`src/ui/keyboard-screen.tsx`): a fixed header, scrolling content and a footer that rises with the keyboard, with `KeyboardAvoidingView` padding on both platforms, since Android draws edge to edge and no longer shrinks the window for the keyboard. On the note screen only the prompts stay in the footer. `useFollowTextEnd` scrolls to the end while the cursor is at the end of the text. No keyboard library is added; `react-native-keyboard-controller` remains the option if this proves unreliable on devices.
- Unsaved text is kept in memory only. Nothing is written outside the encrypted database before the user saves.

## Consequences

- A note written in Paris late in the evening stays on that day, at that time, after a flight to Tokyo.
- Deleting a note leaves no trace of its text in the database file.
- The list is read again each time the journal tab comes into focus. Hundreds of short excerpts make this cheap; paging can come later if needed.
- Statistics can read when notes were written, in local time, without a further migration.
- Text typed before a crash or before the app is killed is lost. An encrypted draft could be added later.
- The video journal of V0.3 will add its own table and the "Tout / Notes / Vidéos" filter.

import { usePreventRemove } from 'expo-router';
import { useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  type ScrollViewInstance,
  type TextInputInstance,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  canSaveDraft,
  draftOf,
  hasUnsavedChanges,
  insertPrompt,
  NOTE_BODY_MAX_LENGTH,
  NOTE_TITLE_MAX_LENGTH,
  noteWrittenAt,
  type Note,
  type NoteDraft,
} from '@/domain/journal';
import { dateOfDay, localDayNumber, utcToLocal } from '@/domain/local-time';
import { ClockContext, useClock } from '@/features/clock/clock-context';
import { createMinuteClock } from '@/features/clock/minute-clock';
import { nativeClockDeps } from '@/features/clock/native-clock';
import { closeNote } from '@/features/journal/close-note';
import { noteDateTime } from '@/features/journal/labels';
import { NotePrompts } from '@/features/journal/note-prompts';
import {
  saveNote,
  SAVE_NOTE_ERROR_MESSAGES,
  type SaveNoteError,
} from '@/features/journal/save-note';
import { deviceCalendar, deviceOffsetAt } from '@/features/shared/device-time';
import { useReduceMotion } from '@/features/shared/use-reduce-motion';
import { useStorage } from '@/features/storage/storage-context';
import { Button } from '@/ui/button';
import { ConfirmSheet } from '@/ui/confirm-sheet';
import { IconButton } from '@/ui/icon-button';
import { CloseIcon } from '@/ui/icons/close-icon';
import { KeyboardScreen, useFollowTextEnd } from '@/ui/keyboard-screen';
import { PrivateLine } from '@/ui/private-line';
import { colors, spacing, typography } from '@/ui/theme';

// Ticks fall on the minute.
const CLOCK_ANCHOR = 0;

type EditorError = SaveNoteError | 'delete-failed' | 'prompt-too-long';

const ERROR_MESSAGES = {
  ...SAVE_NOTE_ERROR_MESSAGES,
  'delete-failed': 'journal.note.errors.delete-failed',
  'prompt-too-long': 'journal.note.errors.prompt-too-long',
} as const satisfies Record<EditorError, string>;

type Sheet = { kind: 'leave'; leave: () => void } | { kind: 'delete' } | null;

// `note` is null for a new note. Every way out, the close button, Android back or a gesture, asks
// first when there are unsaved changes, and nothing can leave while a save or a delete runs. A new
// note that is still empty leaves without asking and is never saved. Only the prompts stay above
// the keyboard; the rest scrolls with the text.
export function NoteEditor({ note }: { note: Note | null }) {
  const { t } = useTranslation();
  const storage = useStorage();
  const [clock] = useState(() => createMinuteClock(CLOCK_ANCHOR, nativeClockDeps));
  const [draft, setDraft] = useState<NoteDraft>(() => draftOf(note));
  const [busy, setBusy] = useState(false);
  // Set once the screen may close without asking: after a save, a delete or a discard.
  const [done, setDone] = useState(false);
  const [error, setError] = useState<EditorError | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  // State updates land one render later, so a second tap in the same frame still sees busy false.
  const working = useRef(false);
  const body = useRef<TextInputInstance>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const reduceMotion = useReduceMotion() !== false;
  const followEnd = useFollowTextEnd(scroll, draft.body, reduceMotion);

  const saved = draftOf(note);
  const dirty = hasUnsavedChanges(saved, draft);
  const canSave = canSaveDraft(saved, draft);

  // working, not busy: a way out taken in the same frame as Save would still see busy false.
  const allowRemove = usePreventRemove(busy || (dirty && !done), ({ repeat }) => {
    if (!working.current) setSheet({ kind: 'leave', leave: repeat });
  });

  function change(next: Partial<NoteDraft>) {
    setError(null);
    setDraft((previous) => ({ ...previous, ...next }));
  }

  // Android reads the message through its live region; iOS has no live regions, so it is
  // announced there.
  function showError(failure: EditorError) {
    setError(failure);
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(t(ERROR_MESSAGES[failure]));
    }
  }

  // busy and done drive usePreventRemove: they change in the same handler as allowRemove, so the
  // prop and the prevention state stay in sync. working stays set, so nothing else starts.
  function close() {
    setBusy(false);
    setDone(true);
    allowRemove();
    closeNote();
  }

  // `asNew` saves the text of a note deleted meanwhile as a new note.
  async function save(asNew = false) {
    if (working.current || !canSave) return;
    working.current = true;
    setBusy(true);
    setError(null);
    const existing = asNew ? null : note;
    const result = await saveNote(storage.journal, existing, draft, Date.now(), deviceOffsetAt);
    if (result.ok) {
      close();
      return;
    }
    working.current = false;
    setBusy(false);
    showError(result.error);
  }

  async function remove() {
    setSheet(null);
    if (working.current || note === null) return;
    working.current = true;
    setBusy(true);
    setError(null);
    const result = await storage.journal.remove(note.id);
    if (result.ok) {
      close();
      return;
    }
    working.current = false;
    setBusy(false);
    showError('delete-failed');
  }

  function discard(leave: () => void) {
    setSheet(null);
    setDone(true);
    leave();
  }

  // The cursor goes after the starter, ready to write. The text field takes the new value on the
  // next frame, so the selection waits for it.
  function insert(starter: string) {
    const next = insertPrompt(draft.body, starter);
    if (!next.ok) {
      showError('prompt-too-long');
      return;
    }
    change({ body: next.value });
    const end = next.value.length;
    requestAnimationFrame(() => {
      body.current?.focus();
      body.current?.setSelection(end, end);
    });
  }

  return (
    <ClockContext value={clock}>
      <KeyboardScreen
        scrollRef={scroll}
        contentContainerStyle={styles.content}
        header={
          <View style={styles.header}>
            <IconButton
              accessibilityLabel={t('journal.note.close')}
              disabled={busy}
              onPress={closeNote}
            >
              <CloseIcon color={colors.text} />
            </IconButton>
            <Button
              label={t('journal.note.save')}
              onPress={() => void save()}
              disabled={busy || !canSave}
            />
          </View>
        }
        footer={
          <View style={styles.footer}>
            {error !== null && (
              <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
                {t(ERROR_MESSAGES[error])}
              </Text>
            )}
            {error === 'note-missing' && (
              <Button
                variant="secondary"
                label={t('journal.note.saveAsNew')}
                disabled={busy}
                onPress={() => void save(true)}
              />
            )}
            <NotePrompts onInsert={insert} />
          </View>
        }
        overlay={
          <>
            <ConfirmSheet
              visible={sheet?.kind === 'leave'}
              title={t('journal.note.leave.title')}
              message={t(
                note === null ? 'journal.note.leave.messageNew' : 'journal.note.leave.message',
              )}
              cancelLabel={t('journal.note.leave.keep')}
              confirmLabel={t('journal.note.leave.discard')}
              onCancel={() => setSheet(null)}
              onConfirm={() => {
                if (sheet?.kind === 'leave') discard(sheet.leave);
              }}
            />
            <ConfirmSheet
              visible={sheet?.kind === 'delete'}
              title={t('journal.note.deleteConfirm.title')}
              message={t('journal.note.deleteConfirm.message')}
              cancelLabel={t('journal.note.deleteConfirm.cancel')}
              confirmLabel={t('journal.note.deleteConfirm.confirm')}
              onCancel={() => setSheet(null)}
              onConfirm={() => void remove()}
            />
          </>
        }
      >
        {note === null ? <CurrentDateTime /> : <WrittenDateTime note={note} />}
        <TextInput
          accessibilityLabel={t('journal.note.titleSpoken')}
          placeholder={t('journal.note.titlePlaceholder')}
          placeholderTextColor={colors.muted}
          value={draft.title}
          maxLength={NOTE_TITLE_MAX_LENGTH}
          onChangeText={(title) => change({ title })}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => body.current?.focus()}
          selectionColor={colors.accent}
          style={styles.title}
        />
        <TextInput
          ref={body}
          accessibilityLabel={t('journal.note.bodySpoken')}
          placeholder={t('journal.note.bodyPlaceholder')}
          placeholderTextColor={colors.muted}
          value={draft.body}
          maxLength={NOTE_BODY_MAX_LENGTH}
          onChangeText={(text) => change({ body: text })}
          {...followEnd}
          multiline
          scrollEnabled={false}
          textAlignVertical="top"
          selectionColor={colors.accent}
          style={styles.body}
        />
        <View style={styles.after}>
          <PrivateLine text={t('journal.note.private')} />
          {note !== null && (
            <Button
              variant="plain"
              label={t('journal.note.delete')}
              disabled={busy}
              onPress={() => setSheet({ kind: 'delete' })}
            />
          )}
        </View>
      </KeyboardScreen>
    </ClockContext>
  );
}

// A new note is dated when it is first saved, so the header follows the clock until then. A
// component of its own, so that the clock ticks re-render nothing else.
function CurrentDateTime() {
  const { t, i18n } = useTranslation();
  const [{ hour12 }] = useState(deviceCalendar);
  const now = useClock((at) => at);
  const local = utcToLocal(now, deviceOffsetAt);
  const year = dateOfDay(localDayNumber(now, deviceOffsetAt)).year;
  return <Text style={styles.date}>{noteDateTime(t, i18n.language, local, year, hour12)}</Text>;
}

// An existing note shows the time it was written at, with the UTC offset of that moment, so it
// reads the same after travel. The year shows when it is not the current one.
function WrittenDateTime({ note }: { note: Note }) {
  const { t, i18n } = useTranslation();
  const [{ hour12 }] = useState(deviceCalendar);
  const year = useClock((at) => dateOfDay(localDayNumber(at, deviceOffsetAt)).year);
  return (
    <Text style={styles.date}>
      {noteDateTime(t, i18n.language, noteWrittenAt(note), year, hour12)}
    </Text>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.l,
    marginBottom: spacing.xl,
  },
  content: {
    gap: spacing.s,
    paddingBottom: spacing.xl,
  },
  date: {
    ...typography.row,
    color: colors.textSecondary,
  },
  title: {
    ...typography.screenTitle,
    paddingVertical: spacing.xs,
    color: colors.text,
  },
  body: {
    ...typography.paragraph,
    minHeight: 160,
    paddingVertical: 0,
    color: colors.text,
  },
  after: {
    gap: spacing.m,
    paddingTop: spacing.l,
  },
  footer: {
    gap: spacing.m,
    paddingTop: spacing.m,
  },
  error: {
    ...typography.body,
    textAlign: 'center',
    color: colors.text,
  },
});

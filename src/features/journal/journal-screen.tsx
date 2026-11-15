import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { NoteSummary } from '@/domain/journal';
import { ClockContext } from '@/features/clock/clock-context';
import { createMinuteClock } from '@/features/clock/minute-clock';
import { nativeClockDeps } from '@/features/clock/native-clock';
import { EmptyJournal } from '@/features/journal/empty-journal';
import { NoteList } from '@/features/journal/note-list';
import { useNotes } from '@/features/journal/use-notes';
import { deviceCalendar } from '@/features/shared/device-time';
import { useWhenFocused } from '@/features/shared/use-when-focused';
import { useStorage } from '@/features/storage/storage-context';
import { Button } from '@/ui/button';
import { IconButton } from '@/ui/icon-button';
import { PencilIcon } from '@/ui/icons/pencil-icon';
import { PrivateLine } from '@/ui/private-line';
import { Screen } from '@/ui/screen';
import { ScreenTitle } from '@/ui/screen-title';
import { colors, spacing, typography } from '@/ui/theme';

function openNew() {
  router.push('/note');
}

function openNote(note: NoteSummary) {
  router.push({ pathname: '/note', params: { id: String(note.id) } });
}

// Ticks fall on the minute; the groups only change at local midnight.
const CLOCK_ANCHOR = 0;

// A read error never leads to a reset: the notes may still be there, so it offers to try again.
// The groups follow a clock rather than the time of the last read, so they move at midnight and
// when the app comes back to the foreground on another day.
export function JournalScreen() {
  const { t } = useTranslation();
  const storage = useStorage();
  const { state, retry } = useNotes(storage.journal);
  const [{ firstWeekday }] = useState(deviceCalendar);
  const [clock] = useState(() => createMinuteClock(CLOCK_ANCHOR, nativeClockDeps));
  const whenFocused = useWhenFocused();
  const write = () => whenFocused(openNew);
  const open = (note: NoteSummary) => whenFocused(() => openNote(note));

  return (
    <Screen>
      <View style={styles.header}>
        <ScreenTitle>{t('journal.title')}</ScreenTitle>
        <IconButton accessibilityLabel={t('journal.newNote')} onPress={write}>
          <PencilIcon color={colors.text} size={20} />
        </IconButton>
      </View>
      <View style={styles.body}>
        {state.status === 'failed' && (
          <View style={styles.centered}>
            <Text style={styles.message}>{t('journal.loadFailed')}</Text>
            <Button variant="secondary" label={t('journal.retry')} onPress={retry} />
          </View>
        )}
        {state.status === 'ready' && state.refreshFailed && (
          <View style={styles.refreshFailed}>
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>
              {t('journal.refreshFailed')}
            </Text>
            <Button variant="plain" label={t('journal.retry')} onPress={retry} />
          </View>
        )}
        {state.status === 'ready' && state.notes.length === 0 && <EmptyJournal onWrite={write} />}
        {state.status === 'ready' && state.notes.length > 0 && (
          <ClockContext value={clock}>
            <NoteList notes={state.notes} firstWeekday={firstWeekday} onOpen={open} />
          </ClockContext>
        )}
      </View>
      <View style={styles.footer}>
        <PrivateLine text={t('journal.private')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.l,
  },
  body: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.l,
  },
  message: {
    ...typography.paragraph,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  refreshFailed: {
    alignItems: 'center',
    paddingTop: spacing.m,
  },
  notice: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  footer: {
    paddingTop: spacing.m,
  },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { groupNotes, type NoteGroupKey, type NoteSummary } from '@/domain/journal';
import { dateOfDay, localDayNumber, type Weekday } from '@/domain/local-time';
import { useClock } from '@/features/clock/clock-context';
import {
  noteGroupTitle,
  noteListDate,
  noteListExcerpt,
  noteRowLabel,
} from '@/features/journal/labels';
import { deviceOffsetAt } from '@/features/shared/device-time';
import { SectionList } from '@/ui/scroll-view';
import { colors, pressedOpacity, radii, spacing, typography } from '@/ui/theme';
import { useLargeText } from '@/ui/use-large-text';

type NoteListProps = {
  notes: readonly NoteSummary[];
  firstWeekday: Weekday;
  onOpen: (note: NoteSummary) => void;
};

type Section = {
  key: string;
  title: string;
  // Dates of the current week stand out in violet, older ones stay quieter.
  recent: boolean;
  data: readonly NoteSummary[];
};

function sectionKey(key: NoteGroupKey): string {
  return key.kind === 'month' ? `${key.year}-${key.month}` : key.kind;
}

// Groups are relative to today, read from the clock, so they move at local midnight.
export function NoteList({ notes, firstWeekday, onOpen }: NoteListProps) {
  const { t, i18n } = useTranslation();
  const today = useClock((now) => localDayNumber(now, deviceOffsetAt));
  const currentYear = dateOfDay(today).year;
  const sections: Section[] = groupNotes(notes, today, firstWeekday).map((group) => ({
    key: sectionKey(group.key),
    title: noteGroupTitle(t, i18n.language, group.key, currentYear),
    recent: group.key.kind === 'this-week',
    data: group.notes,
  }));

  return (
    <SectionList<NoteSummary, Section>
      style={styles.list}
      sections={sections}
      keyExtractor={(note) => String(note.id)}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <Text accessibilityRole="header" style={styles.header}>
          {section.title}
        </Text>
      )}
      renderItem={({ item, section }) => (
        <NoteRow note={item} recent={section.recent} onOpen={onOpen} />
      )}
    />
  );
}

// A title fits one line at the usual text sizes. With large text, one line would hold a word or
// two, so the title gets up to three. The excerpt keeps its three lines: the note opens in full.
const TITLE_LINES = 1;
const TITLE_LINES_LARGE_TEXT = 3;

type NoteRowProps = { note: NoteSummary; recent: boolean; onOpen: (note: NoteSummary) => void };

function NoteRow({ note, recent, onOpen }: NoteRowProps) {
  const { i18n } = useTranslation();
  const largeText = useLargeText();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={noteRowLabel(i18n.language, note)}
      onPress={() => onOpen(note)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={[styles.date, recent && styles.recentDate]}>
        {noteListDate(i18n.language, note.day)}
      </Text>
      <View style={styles.content}>
        {note.title !== null && (
          <Text
            numberOfLines={largeText ? TITLE_LINES_LARGE_TEXT : TITLE_LINES}
            style={styles.title}
          >
            {note.title}
          </Text>
        )}
        <Text numberOfLines={3} style={styles.excerpt}>
          {noteListExcerpt(note.excerpt)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  header: {
    ...typography.bodyLarge,
    fontSize: 18,
    fontFamily: typography.row.fontFamily,
    color: colors.textSecondary,
    paddingTop: spacing.xl,
    paddingBottom: spacing.m,
  },
  row: {
    gap: spacing.s,
    marginBottom: spacing.m,
    padding: spacing.card,
    borderRadius: radii.cardLarge,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: pressedOpacity,
  },
  date: {
    ...typography.row,
    fontFamily: typography.quote.fontFamily,
    color: colors.textSecondary,
  },
  recentDate: {
    color: colors.accentText,
  },
  content: {
    gap: spacing.xxs,
  },
  title: {
    ...typography.rankCardName,
    color: colors.text,
  },
  excerpt: {
    ...typography.paragraph,
    color: colors.text,
  },
});

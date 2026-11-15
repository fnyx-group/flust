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
import { colors, pressedOpacity, spacing, typography } from '@/ui/theme';

type NoteListProps = {
  notes: readonly NoteSummary[];
  firstWeekday: Weekday;
  onOpen: (note: NoteSummary) => void;
};

type Section = { key: string; title: string; data: readonly NoteSummary[] };

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
      renderItem={({ item }) => <NoteRow note={item} onOpen={onOpen} />}
    />
  );
}

function NoteRow({ note, onOpen }: { note: NoteSummary; onOpen: (note: NoteSummary) => void }) {
  const { t, i18n } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={noteRowLabel(i18n.language, note)}
      accessibilityHint={t('journal.openHint')}
      onPress={() => onOpen(note)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.date}>{noteListDate(i18n.language, note.day)}</Text>
      <View style={styles.content}>
        {note.title !== null && (
          <Text numberOfLines={1} style={styles.title}>
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
    ...typography.sectionLabel,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xs,
  },
  row: {
    gap: spacing.xs,
    paddingVertical: spacing.l,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  pressed: {
    opacity: pressedOpacity,
  },
  date: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
  },
  content: {
    gap: spacing.xxs,
  },
  title: {
    ...typography.rankName,
    color: colors.text,
  },
  excerpt: {
    ...typography.paragraph,
    color: colors.text,
  },
});

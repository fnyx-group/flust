import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Note } from '@/domain/journal';
import { closeNote } from '@/features/journal/close-note';
import { NoteEditor } from '@/features/journal/note-editor';
import { noteTarget } from '@/features/journal/note-param';
import { useStorage } from '@/features/storage/storage-context';
import { Button } from '@/ui/button';
import { IconButton } from '@/ui/icon-button';
import { CloseIcon } from '@/ui/icons/close-icon';
import { Screen } from '@/ui/screen';
import { colors, spacing, typography } from '@/ui/theme';

type Loaded =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly note: Note | null }
  | { readonly status: 'missing' }
  | { readonly status: 'failed' };

// A note that cannot be found, or an id that is not one, says so instead of closing on its own. A
// read error may be temporary, so it offers to try again. The close button is there from the
// start, so a slow read never traps the user.
export function NoteScreen({ idParam }: { idParam: string | string[] | undefined }) {
  const storage = useStorage();
  const [target] = useState(() => noteTarget(idParam));
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded>(() => {
    if (target.kind === 'new') return { status: 'ready', note: null };
    if (target.kind === 'invalid') return { status: 'missing' };
    return { status: 'loading' };
  });

  useEffect(() => {
    if (target.kind !== 'edit') return;
    let active = true;
    void storage.journal.get(target.id).then((result) => {
      if (!active) return;
      if (!result.ok) setLoaded({ status: 'failed' });
      else if (result.value === null) setLoaded({ status: 'missing' });
      else setLoaded({ status: 'ready', note: result.value });
    });
    return () => {
      active = false;
    };
  }, [storage, target, attempt]);

  function retry() {
    setLoaded({ status: 'loading' });
    setAttempt((previous) => previous + 1);
  }

  if (loaded.status === 'ready') return <NoteEditor note={loaded.note} />;
  return (
    <NoteUnavailable
      status={loaded.status}
      onRetry={loaded.status === 'failed' ? retry : undefined}
    />
  );
}

function NoteUnavailable({
  status,
  onRetry,
}: {
  status: 'loading' | 'missing' | 'failed';
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const message = status === 'loading' ? null : t(`journal.note.unavailable.${status}`);

  // Android reads the message through its live region; iOS has no live regions.
  useEffect(() => {
    if (message !== null && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [message]);

  return (
    <Screen bottomInset>
      <View style={styles.header}>
        <IconButton accessibilityLabel={t('journal.note.close')} onPress={closeNote}>
          <CloseIcon color={colors.text} />
        </IconButton>
      </View>
      {message !== null && (
        <View style={styles.centered}>
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.message}>
            {message}
          </Text>
          {onRetry !== undefined && (
            <Button variant="secondary" label={t('journal.retry')} onPress={onRetry} />
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    marginBottom: spacing.xl,
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
});

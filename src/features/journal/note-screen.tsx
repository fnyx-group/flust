import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Note } from '@/domain/journal';
import { NoteEditor } from '@/features/journal/note-editor';
import { noteTarget } from '@/features/journal/note-param';
import { useStorage } from '@/features/storage/storage-context';
import { Screen } from '@/ui/screen';

type Loaded = { readonly note: Note | null };

// A note that cannot be found or read, or an id that is not one, goes back to where the user
// came from: there is nothing to edit.
export function NoteScreen({ idParam }: { idParam: string | string[] | undefined }) {
  const storage = useStorage();
  const [target] = useState(() => noteTarget(idParam));
  const [loaded, setLoaded] = useState<Loaded | null>(
    target.kind === 'new' ? { note: null } : null,
  );

  useEffect(() => {
    if (target.kind === 'new') return;
    if (target.kind === 'invalid') {
      router.back();
      return;
    }
    let active = true;
    void storage.journal.get(target.id).then((result) => {
      if (!active) return;
      if (result.ok && result.value !== null) setLoaded({ note: result.value });
      else router.back();
    });
    return () => {
      active = false;
    };
  }, [storage, target]);

  if (loaded === null) {
    return (
      <Screen bottomInset>
        <View style={styles.fill} />
      </Screen>
    );
  }
  return <NoteEditor note={loaded.note} />;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});

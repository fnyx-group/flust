import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import type { JournalRepository } from '@/data/journal-repository';
import type { NoteSummary } from '@/domain/journal';

// `refreshFailed` is set when reading again failed while notes were already on screen: they stay,
// since they are most likely still right.
export type NotesState =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | {
      readonly status: 'ready';
      readonly notes: readonly NoteSummary[];
      readonly refreshFailed: boolean;
    };

// The list is read again each time the tab comes into focus, so a note saved or deleted on the
// note screen shows on return. The previous list stays on screen while it reloads. Only the
// latest read may land: a read started earlier, or one still running when the tab loses focus,
// is ignored.
export function useNotes(journal: JournalRepository): { state: NotesState; retry: () => void } {
  const [state, setState] = useState<NotesState>({ status: 'loading' });
  const cancelRead = useRef<(() => void) | null>(null);

  const load = useCallback(() => {
    cancelRead.current?.();
    let active = true;
    const cancel = () => {
      active = false;
    };
    cancelRead.current = cancel;
    void journal.list().then((result) => {
      if (!active) return;
      setState((previous) => {
        if (result.ok) return { status: 'ready', notes: result.value, refreshFailed: false };
        return previous.status === 'ready'
          ? { ...previous, refreshFailed: true }
          : { status: 'failed' };
      });
    });
    return cancel;
  }, [journal]);

  useFocusEffect(load);

  return {
    state,
    retry: () => {
      setState((previous) => (previous.status === 'failed' ? { status: 'loading' } : previous));
      load();
    },
  };
}

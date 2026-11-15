import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { JournalRepository } from '@/data/journal-repository';
import type { NoteSummary } from '@/domain/journal';
import { localDayNumber } from '@/domain/local-time';
import { deviceOffsetAt } from '@/features/shared/device-time';

// `today` is the local day the notes were read on, which their grouping is relative to.
export type NotesState =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | { readonly status: 'ready'; readonly notes: readonly NoteSummary[]; readonly today: number };

// The list is read again each time the tab comes into focus, so a note saved or deleted on the
// note screen shows on return. The previous list stays on screen while it reloads.
export function useNotes(journal: JournalRepository): { state: NotesState; retry: () => void } {
  const [state, setState] = useState<NotesState>({ status: 'loading' });

  const load = useCallback(() => {
    let active = true;
    void journal.list().then((result) => {
      if (!active) return;
      setState(
        result.ok
          ? {
              status: 'ready',
              notes: result.value,
              today: localDayNumber(Date.now(), deviceOffsetAt),
            }
          : { status: 'failed' },
      );
    });
    return () => {
      active = false;
    };
  }, [journal]);

  useFocusEffect(load);

  return {
    state,
    retry: () => {
      setState({ status: 'loading' });
      load();
    },
  };
}

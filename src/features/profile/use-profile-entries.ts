import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import type { ProfileEntries, ProfileRepository } from '@/data/profile-repository';

export type EntriesState =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | { readonly status: 'ready'; readonly entries: ProfileEntries };

// Read again each time the screen comes into focus, so a reason or a plan saved on its own screen
// shows on return. What is on screen stays while it reloads, and stays if reading again fails:
// it is most likely still right. Only the latest read may land.
export function useProfileEntries(profile: ProfileRepository) {
  const [state, setState] = useState<EntriesState>({ status: 'loading' });
  const cancelRead = useRef<(() => void) | null>(null);

  const load = useCallback(() => {
    cancelRead.current?.();
    let active = true;
    const cancel = () => {
      active = false;
    };
    cancelRead.current = cancel;
    void profile.loadEntries().then((result) => {
      if (!active) return;
      setState((previous) => {
        if (result.ok) return { status: 'ready', entries: result.value };
        return previous.status === 'ready' ? previous : { status: 'failed' };
      });
    });
    return cancel;
  }, [profile]);

  useFocusEffect(load);

  return {
    state,
    // For changes made on the screen itself, such as the risk moments, without reading again.
    update: (change: (entries: ProfileEntries) => ProfileEntries) =>
      setState((previous) =>
        previous.status === 'ready' ? { ...previous, entries: change(previous.entries) } : previous,
      ),
    retry: () => {
      setState({ status: 'loading' });
      load();
    },
  };
}

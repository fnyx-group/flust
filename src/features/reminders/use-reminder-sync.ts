import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';

import { notificationLabels, notificationText } from '@/features/reminders/labels';
import { notifier } from '@/features/reminders/notifier';
import { createSerialRunner, syncReminders } from '@/features/reminders/reminder-sync';
import { onReminderSyncRequest } from '@/features/reminders/sync-requests';
import { useSession } from '@/features/session/session-context';
import { deviceOffsetAt } from '@/features/shared/device-time';
import { useStorage } from '@/features/storage/storage-context';
import type { Storage } from '@/data/open-storage';
import { i18n } from '@/lib/i18n';

// Reads the language when a sync runs, so a change of language is used by the next one.
function createSync(storage: Storage) {
  return createSerialRunner(() =>
    syncReminders({
      storage,
      notifier,
      now: Date.now(),
      offsetAt: deviceOffsetAt,
      labels: notificationLabels(i18n.t),
      bodyOf: (kind) => notificationText(i18n.t, kind),
    }),
  );
}

// Plans reminders again whenever what they depend on changes: on launch and on each return to
// the app, since the spacing counts from today, and after a check-in, a lapse or a new rank.
export function useReminderSync(): void {
  const storage = useStorage();
  const { journey, latestLapse, checkIns, unlockedRanks } = useSession();
  const sync = useMemo(() => createSync(storage), [storage]);

  useEffect(() => onReminderSyncRequest(() => void sync()), [sync]);

  useEffect(() => {
    void notifier.clearDelivered();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void notifier.clearDelivered();
      void sync();
    });
    return () => subscription.remove();
  }, [sync]);

  useEffect(() => {
    if (journey !== null) void sync();
  }, [sync, journey, latestLapse, checkIns, unlockedRanks]);
}

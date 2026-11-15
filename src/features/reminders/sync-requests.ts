type Listener = () => void;

const listeners = new Set<Listener>();

// Screens that change what reminders depend on, such as their settings or the language, ask for
// them to be planned again. The sync itself lives in one place, below the session.
export function requestReminderSync(): void {
  for (const listener of listeners) listener();
}

export function onReminderSyncRequest(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let pauses = 0;
let waitForSync: () => Promise<void> = async () => undefined;

// The sync below the session tells how to wait for a plan being made, so an erase can let it
// finish before anything is cancelled.
export function onReminderSyncIdle(wait: () => Promise<void>): () => void {
  waitForSync = wait;
  return () => {
    if (waitForSync === wait) waitForSync = async () => undefined;
  };
}

export function reminderSyncPaused(): boolean {
  return pauses > 0;
}

// Stops reminders from being planned, then waits for a plan already being made, which will not
// land. Returns the function that lets planning resume.
export async function pauseReminderSync(): Promise<() => void> {
  pauses += 1;
  let resumed = false;
  const resume = () => {
    if (resumed) return;
    resumed = true;
    pauses -= 1;
  };
  await waitForSync();
  return resume;
}

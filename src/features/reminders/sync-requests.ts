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

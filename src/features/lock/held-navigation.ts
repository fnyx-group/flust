import type { NotificationRoute } from '@/features/reminders/notification-route';

// Where to go once the app is unlocked, for a link or a notification tap that arrived while it
// was locked. Module state, because expo-router asks +native-intent about links outside React.
// Only the latest is kept: it is what the person asked for last.
export type HeldNavigation =
  | { readonly kind: 'link'; readonly url: string }
  | { readonly kind: 'route'; readonly route: NotificationRoute };

let locked = false;
let held: HeldNavigation | null = null;
const listeners = new Set<() => void>();

export function setLocked(value: boolean): void {
  locked = value;
  if (!value && held !== null) for (const listener of listeners) listener();
}

export function isLocked(): boolean {
  return locked;
}

export function hold(navigation: HeldNavigation): void {
  held = navigation;
}

export function takeHeld(): HeldNavigation | null {
  const navigation = held;
  held = null;
  return navigation;
}

// Called when the app is unlocked with something held.
export function onReleased(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// A link arriving while the app runs is held when it is locked, so no screen mounts, and no
// visit or rank is recorded, before the person unlocks. A link that launches the app passes: no
// route mounts before the first unlock anyway.
export function redirectLink(path: string, initial: boolean): string | null {
  if (initial || !locked) return path;
  hold({ kind: 'link', url: path });
  return null;
}

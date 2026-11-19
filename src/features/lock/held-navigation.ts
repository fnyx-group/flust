import type { NotificationRoute } from '@/features/reminders/notification-route';

// Where to go once the app is unlocked, for a notification tap that arrived while it was locked.
// Module state, shared by the tap listener and the navigation that follows the unlock. Only the
// latest is kept: it is what the person asked for last.
let locked = false;
let held: NotificationRoute | null = null;
const listeners = new Set<() => void>();

export function setLocked(value: boolean): void {
  locked = value;
  if (!value && held !== null) for (const listener of listeners) listener();
}

export function isLocked(): boolean {
  return locked;
}

export function hold(route: NotificationRoute): void {
  held = route;
}

export function takeHeld(): NotificationRoute | null {
  const route = held;
  held = null;
  return route;
}

export function onReleased(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

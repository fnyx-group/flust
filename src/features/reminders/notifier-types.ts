import type { LocalDateTime } from '@/domain/local-time';
import type { Timestamp } from '@/domain/time';
import type { NotificationRoute } from '@/features/reminders/notification-route';

export type NotificationPermission = {
  readonly granted: boolean;
  // False once the system will no longer show its prompt: only the settings can allow them.
  readonly canAskAgain: boolean;
};

export type ScheduledNotification = {
  readonly id: number;
  readonly body: string;
  readonly route: NotificationRoute;
  readonly local: LocalDateTime;
  readonly floating: boolean;
  readonly at: Timestamp;
};

export type NotificationLabels = {
  readonly channelName: string;
  readonly channelDescription: string;
  readonly previewPlaceholder: string;
};

// Local notifications only. Each platform has its own file: iOS uses expo-notifications, Android
// the flust-reminders module, so Android never links Firebase.
export type Notifier = {
  getPermission(): Promise<NotificationPermission>;
  requestPermission(): Promise<NotificationPermission>;
  // Names the Android channel and the iOS hidden preview in the current language.
  describe(labels: NotificationLabels): Promise<void>;
  // Replaces every planned notification.
  replace(notifications: readonly ScheduledNotification[]): Promise<void>;
  clearDelivered(): Promise<void>;
  // The screen of the notification that launched the app, once.
  takeLaunchTap(): Promise<NotificationRoute | null>;
  onTap(listener: (route: NotificationRoute) => void): () => void;
};

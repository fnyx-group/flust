import type { Notifier } from '@/features/reminders/notifier-types';

// Platforms without local notifications, such as the web build. iOS and Android have their own
// notifier.ios.ts and notifier.android.ts.
export const notifier: Notifier = {
  getPermission: async () => ({ granted: false, canAskAgain: false }),
  requestPermission: async () => ({ granted: false, canAskAgain: false }),
  describe: async () => undefined,
  replace: async () => undefined,
  clearDelivered: async () => undefined,
  takeLaunchTap: async () => null,
  onTap: () => () => undefined,
};

import { errorLog, launchGuard, storageService } from '@/data/native';
import { notifier } from '@/features/reminders/notifier';
import { pauseReminderSync } from '@/features/reminders/sync-requests';
import { createEraseFlow, type EraseStep } from '@/features/storage/erase-flow';
import { i18n } from '@/lib/i18n';
import { getDeviceLanguage } from '@/lib/i18n/language';

// The erase flow wired to the app's storage, reminders, error log and launch counter, for the
// settings and for safe mode.
export function createAppEraseFlow(show: (step: EraseStep) => void) {
  return createEraseFlow({
    reset: () => storageService.reset(),
    applyDeviceLanguage: async () => {
      await i18n.changeLanguage(getDeviceLanguage());
    },
    pauseReminders: pauseReminderSync,
    clearReminders: async () => {
      await notifier.replace([]);
      await notifier.clearDelivered();
    },
    eraseDiagnostics: async () => {
      const cleared = await errorLog.clear();
      const counterGone = await launchGuard.finish();
      return cleared.ok && counterGone;
    },
    pauseDiagnostics: () => errorLog.pause(),
    show,
  });
}

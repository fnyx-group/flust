import { useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Protection } from '@/domain/onboarding';
import { DEFAULT_REMINDER_SETTINGS } from '@/domain/reminders';
import { lockToggleLabel } from '@/features/lock/labels';
import { authenticate } from '@/features/lock/local-auth';
import { useLock } from '@/features/lock/lock-context';
import { formatReminderTime } from '@/features/reminders/labels';
import { notifier } from '@/features/reminders/notifier';
import { deviceCalendar } from '@/features/shared/device-time';
import { RowGroup } from '@/ui/row-group';
import { SwitchRow } from '@/ui/switch-row';
import { colors, spacing, typography } from '@/ui/theme';

type ProtectionCardProps = {
  protection: Protection;
  onChange: (protection: Protection) => void;
};

type Notice = 'lock-unavailable' | 'lock-not-confirmed' | 'denied' | null;

const NOTICES = {
  'lock-unavailable': 'onboarding.start.protection.lockUnavailable',
  'lock-not-confirmed': 'onboarding.start.protection.lockNotConfirmed',
  denied: 'reminders.denied',
} as const;

// Both start off. Each asks the device when turned on, so what is chosen here is known to work:
// the lock is confirmed once, and the reminder only stays on once notifications are allowed.
export function ProtectionCard({ protection, onChange }: ProtectionCardProps) {
  const { t, i18n } = useTranslation();
  const lock = useLock();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [{ hour12 }] = useState(deviceCalendar);

  function show(next: Notice) {
    setNotice(next);
    if (next !== null && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(t(NOTICES[next]));
    }
  }

  async function run(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    show(null);
    await task();
    setBusy(false);
  }

  async function toggleLock(on: boolean) {
    if (!on) return onChange({ ...protection, lock: false });
    const security = await lock.refreshSecurity();
    if (security.kind === 'none') return show('lock-unavailable');
    const outcome = await lock.withSystemScreen(() =>
      authenticate({ prompt: t('lock.prompt'), cancel: t('lock.cancel') }),
    );
    if (outcome === 'success') onChange({ ...protection, lock: true });
    else show('lock-not-confirmed');
  }

  async function toggleCheckIn(on: boolean) {
    if (!on) return onChange({ ...protection, checkInReminder: false });
    const current = await notifier.getPermission();
    const permission =
      current.granted || !current.canAskAgain
        ? current
        : await lock.withSystemScreen(() => notifier.requestPermission());
    if (permission.granted) onChange({ ...protection, checkInReminder: true });
    else show('denied');
  }

  const time = formatReminderTime(i18n.language, DEFAULT_REMINDER_SETTINGS.checkIn.minute, hour12);
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{t('onboarding.start.protection.label')}</Text>
      <RowGroup>
        <SwitchRow
          title={lockToggleLabel(t, lock.security, Platform.OS)}
          subtitle={t('lock.settings.toggleSubtitle')}
          value={protection.lock}
          disabled={busy}
          onChange={(on) => void run(() => toggleLock(on))}
        />
        <SwitchRow
          title={t('reminders.checkIn.title')}
          subtitle={t('onboarding.start.protection.checkInSubtitle', { time })}
          value={protection.checkInReminder}
          disabled={busy}
          onChange={(on) => void run(() => toggleCheckIn(on))}
        />
      </RowGroup>
      {notice !== null && (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>
          {t(NOTICES[notice])}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.m,
  },
  label: {
    ...typography.label,
    paddingHorizontal: spacing.xs,
  },
  notice: {
    ...typography.body,
    color: colors.text,
  },
});

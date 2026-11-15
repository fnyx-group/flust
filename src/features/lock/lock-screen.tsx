import { useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { NO_ATTEMPTS, recordFailure, type Attempts } from '@/domain/lock';
import { countsAsAttempt } from '@/features/lock/auth-outcome';
import { waitLabel } from '@/features/lock/labels';
import { authenticate, type DeviceSecurity } from '@/features/lock/local-auth';
import { useLock } from '@/features/lock/lock-context';
import { useWaitCountdown } from '@/features/lock/wait-countdown';
import { useStorage } from '@/features/storage/storage-context';
import { BrandLockup } from '@/ui/brand/brand-lockup';
import { Button } from '@/ui/button';
import { Screen } from '@/ui/screen';
import { colors, spacing, typography } from '@/ui/theme';

type LockScreenProps = {
  security: DeviceSecurity;
  attempts: Attempts;
  onAttempts: (attempts: Attempts) => void;
  onUnlock: () => void;
};

// The system prompt offers the device passcode itself. With biometrics, "Enter passcode" opens
// the same prompt; without them, the passcode is the only way, so it is the main button.
export function LockScreen({ security, attempts, onAttempts, onUnlock }: LockScreenProps) {
  const { t } = useTranslation();
  const storage = useStorage();
  const lock = useLock();
  const [busy, setBusy] = useState(false);
  const [lockout, setLockout] = useState(false);

  function store(next: Attempts) {
    void storage.lock.saveAttempts(next, Date.now());
  }

  const remaining = useWaitCountdown(attempts, {
    save: store,
    onEnd: () => {
      const next = { ...attempts, waitMs: 0 };
      onAttempts(next);
      store(next);
    },
  });
  const waiting = remaining > 0;

  function announce(message: string) {
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
  }

  // The screen lock is read again at each attempt. Only a read that confirms there is none opens
  // without asking, so a device without a passcode is never locked out, and a read that fails
  // never opens the app.
  async function unlock() {
    if (busy || waiting) return;
    setBusy(true);
    setLockout(false);
    if ((await lock.refreshSecurity()).kind === 'none') {
      setBusy(false);
      open();
      return;
    }
    const outcome = await lock.withSystemScreen(() =>
      authenticate({ prompt: t('lock.prompt'), cancel: t('lock.cancel') }),
    );
    const removed = outcome === 'unavailable' && (await lock.refreshSecurity()).kind === 'none';
    setBusy(false);
    if (outcome === 'success' || removed) {
      open();
      return;
    }
    if (outcome === 'lockout') {
      setLockout(true);
      announce(t('lock.lockout'));
    }
    if (countsAsAttempt(outcome)) {
      const next = recordFailure(attempts);
      onAttempts(next);
      store(next);
      if (next.waitMs > 0) announce(waitLabel(t, next.waitMs));
    }
  }

  function open() {
    onAttempts(NO_ATTEMPTS);
    store(NO_ATTEMPTS);
    onUnlock();
  }

  const biometric = security.kind === 'biometric';
  return (
    <Screen bottomInset>
      <View style={styles.center}>
        <BrandLockup />
        <Text style={styles.status}>{t('lock.locked')}</Text>
      </View>
      <View style={styles.bottom}>
        {(waiting || lockout) && (
          <Text accessibilityLiveRegion="polite" style={styles.message}>
            {waiting ? waitLabel(t, remaining) : t('lock.lockout')}
          </Text>
        )}
        <Button
          label={biometric ? t('lock.unlock') : t('lock.usePasscode')}
          onPress={() => void unlock()}
          disabled={busy || waiting}
        />
        {biometric && (
          <Button
            variant="plain"
            label={t('lock.usePasscode')}
            onPress={() => void unlock()}
            disabled={busy || waiting}
          />
        )}
      </View>
    </Screen>
  );
}

// Shown the moment the app leaves the foreground, until it is back and has decided whether to
// ask again. It looks like the lock screen without its buttons, so nothing jumps either way.
export function LockCover() {
  const { t } = useTranslation();
  return (
    <Screen bottomInset>
      <View accessible accessibilityLabel={t('lock.cover')} style={styles.center}>
        <BrandLockup />
        <Text style={[styles.status, styles.invisible]}>{t('lock.locked')}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  status: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
  },
  // Keeps the lockup where the lock screen puts it.
  invisible: {
    opacity: 0,
  },
  bottom: {
    gap: spacing.s,
  },
  message: {
    ...typography.body,
    textAlign: 'center',
    color: colors.text,
    paddingBottom: spacing.s,
  },
});

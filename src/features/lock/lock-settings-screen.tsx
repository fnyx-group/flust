import { useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LOCK_DELAYS, type LockSettings } from '@/domain/lock';
import { delayLabel, lockToggleLabel } from '@/features/lock/labels';
import { authenticate } from '@/features/lock/local-auth';
import { useLock } from '@/features/lock/lock-context';
import { useGoBack } from '@/features/navigation/use-go-back';
import { useStorage } from '@/features/storage/storage-context';
import { BackHeader } from '@/ui/back-header';
import { LockIcon } from '@/ui/icons/lock-icon';
import { RadioGroup } from '@/ui/radio-group';
import { RowGroup } from '@/ui/row-group';
import { Screen } from '@/ui/screen';
import { ScrollView } from '@/ui/scroll-view';
import { SectionLabel } from '@/ui/section-label';
import { SwitchRow } from '@/ui/switch-row';
import { colors, spacing, typography } from '@/ui/theme';

type Notice = 'not-confirmed' | 'save-failed' | null;

const NOTICES = {
  'not-confirmed': 'lock.settings.notConfirmed',
  'save-failed': 'lock.settings.saveFailed',
} as const;

// Turning the lock on or off asks the device first, so it is known to work and cannot be turned
// off by someone else holding the unlocked phone.
export function LockSettingsScreen() {
  const goBack = useGoBack('/settings');
  const { t } = useTranslation();
  const storage = useStorage();
  const lock = useLock();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const { settings, security, paused } = lock;
  const noDeviceLock = security.kind === 'none';

  function show(next: Notice) {
    setNotice(next);
    if (next !== null && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(t(NOTICES[next]));
    }
  }

  async function save(next: LockSettings): Promise<boolean> {
    const saved = await storage.lock.saveSettings(next);
    if (!saved.ok) {
      show('save-failed');
      return false;
    }
    lock.applySettings(next);
    return true;
  }

  async function toggle(enabled: boolean) {
    if (busy) return;
    setBusy(true);
    show(null);
    const current = await lock.refreshSecurity();
    // A paused lock cannot ask, and removing the screen lock already took the device passcode.
    if (current.kind === 'none') {
      if (!enabled) await save({ ...settings, enabled });
      setBusy(false);
      return;
    }
    const outcome = await lock.withSystemScreen(() =>
      authenticate({ prompt: t('lock.prompt'), cancel: t('lock.cancel') }),
    );
    if (outcome === 'success') await save({ ...settings, enabled });
    else show('not-confirmed');
    setBusy(false);
  }

  return (
    <Screen bottomInset>
      <BackHeader
        backLabel={t('lock.settings.back')}
        title={t('lock.settings.title')}
        onBack={goBack}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <RowGroup>
          <SwitchRow
            title={lockToggleLabel(t, security, Platform.OS)}
            subtitle={t('lock.settings.toggleSubtitle')}
            icon={{ icon: LockIcon, color: colors.teal }}
            value={settings.enabled}
            disabled={busy || (noDeviceLock && !settings.enabled)}
            onChange={(value) => void toggle(value)}
          />
        </RowGroup>
        {settings.enabled && (
          <View style={styles.section}>
            <SectionLabel color={colors.accentText}>{t('lock.settings.delay')}</SectionLabel>
            <RadioGroup
              accessibilityLabel={t('lock.settings.delay')}
              options={LOCK_DELAYS.map((delay) => ({
                key: String(delay),
                label: delayLabel(t, delay),
              }))}
              selected={String(settings.delay)}
              onSelect={(key) => void save({ ...settings, delay: Number(key) })}
            />
          </View>
        )}
        {(noDeviceLock || paused || notice !== null) && (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>
            {notice !== null
              ? t(NOTICES[notice])
              : t(paused ? 'lock.settings.paused' : 'lock.settings.noDeviceLock')}
          </Text>
        )}
        <View>
          <Text style={styles.note}>{t('lock.settings.note')}</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.l,
  },
  section: {
    gap: spacing.m,
  },
  notice: {
    ...typography.body,
    color: colors.text,
  },
  note: {
    ...typography.paragraph,
    color: colors.textSecondary,
  },
});

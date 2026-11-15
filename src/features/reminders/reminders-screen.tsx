import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { localDayNumber } from '@/domain/local-time';
import type { RiskMomentId } from '@/domain/presets';
import {
  allRemindersOff,
  hasTimedRiskMoment,
  setCheckInReminder,
  stepMinute,
  type MinuteOfDay,
  type ReminderSettings,
} from '@/domain/reminders';
import { useLock } from '@/features/lock/lock-context';
import { formatReminderTime } from '@/features/reminders/labels';
import { notifier } from '@/features/reminders/notifier';
import type { NotificationPermission } from '@/features/reminders/notifier-types';
import { NotificationPreview } from '@/features/reminders/notification-preview';
import { requestReminderSync } from '@/features/reminders/sync-requests';
import { deviceCalendar, deviceOffsetAt } from '@/features/shared/device-time';
import { useStorage } from '@/features/storage/storage-context';
import { BackHeader } from '@/ui/back-header';
import { Button } from '@/ui/button';
import { RowGroup } from '@/ui/row-group';
import { Screen } from '@/ui/screen';
import { ScrollView } from '@/ui/scroll-view';
import { SwitchRow } from '@/ui/switch-row';
import { colors, pressedOpacity, radii, spacing, typography } from '@/ui/theme';
import { TimeSheet } from '@/ui/time-sheet';

type Timed = 'checkIn' | 'thought';

type Loaded = {
  settings: ReminderSettings;
  riskMoments: readonly RiskMomentId[];
};

// Every reminder is off until it is turned on here. The permission is asked only then, and a
// refusal leaves the reminder off with a way to the system settings. Without the permission,
// every reminder is off, as the sync stores them, so turning one on never brings back the others.
export function RemindersScreen() {
  const { t, i18n } = useTranslation();
  const storage = useStorage();
  const lock = useLock();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [notice, setNotice] = useState<'save-failed' | 'load-failed' | null>(null);
  const [editing, setEditing] = useState<{ kind: Timed; minute: MinuteOfDay } | null>(null);
  const [{ hour12 }] = useState(deviceCalendar);

  const readPermission = useCallback(() => {
    void notifier.getPermission().then(setPermission);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      readPermission();
      void Promise.all([storage.reminders.load(), storage.profile.load()]).then(
        ([settings, profile]) => {
          if (!active) return;
          if (!settings.ok) {
            setNotice('load-failed');
            return;
          }
          setLoaded({
            settings: settings.value,
            riskMoments: profile.ok ? profile.value.riskMoments : [],
          });
        },
      );
      return () => {
        active = false;
      };
    }, [storage, readPermission]),
  );

  // Coming back from the system settings, the permission may have changed.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') readPermission();
    });
    return () => subscription.remove();
  }, [readPermission]);

  if (loaded === null) {
    return (
      <Screen bottomInset>
        <Header />
        {notice === 'load-failed' && <Text style={styles.notice}>{t('reminders.loadFailed')}</Text>}
      </Screen>
    );
  }

  const granted = permission?.granted === true;
  const riskMoments = loaded.riskMoments;
  const settings = granted ? loaded.settings : allRemindersOff(loaded.settings);
  const denied = permission !== null && !granted;
  const timedMoments = hasTimedRiskMoment(riskMoments);

  async function save(next: ReminderSettings) {
    const saved = await storage.reminders.save(next);
    if (!saved.ok) {
      setNotice('save-failed');
      if (Platform.OS === 'ios')
        AccessibilityInfo.announceForAccessibility(t('reminders.saveFailed'));
      return;
    }
    setNotice(null);
    setLoaded({ settings: next, riskMoments });
    requestReminderSync();
  }

  // Turning one on asks for notifications first, and stays off if they are not allowed.
  async function allowed(): Promise<boolean> {
    if (granted) return true;
    const asked =
      permission?.canAskAgain === false
        ? permission
        : await lock.withSystemScreen(() => notifier.requestPermission());
    setPermission(asked);
    return asked.granted;
  }

  async function toggle(change: (on: boolean) => ReminderSettings, on: boolean) {
    if (on && !(await allowed())) return;
    await save(change(on));
  }

  function timeChip(kind: Timed) {
    const minute = settings[kind].minute;
    const time = formatReminderTime(i18n.language, minute, hour12);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('reminders.time', { time })}
        accessibilityHint={t('reminders.timeHint')}
        onPress={() => setEditing({ kind, minute })}
        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
      >
        <Text style={styles.chipText}>{time}</Text>
      </Pressable>
    );
  }

  return (
    <Screen bottomInset>
      <Header />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <RowGroup>
          <SwitchRow
            title={t('reminders.checkIn.title')}
            subtitle={t('reminders.checkIn.subtitle')}
            value={settings.checkIn.on}
            onChange={(on) =>
              void toggle(
                (value) =>
                  setCheckInReminder(settings, value, localDayNumber(Date.now(), deviceOffsetAt)),
                on,
              )
            }
          >
            {settings.checkIn.on && timeChip('checkIn')}
          </SwitchRow>
          <SwitchRow
            title={t('reminders.thought.title')}
            subtitle={t('reminders.thought.subtitle')}
            value={settings.thought.on}
            onChange={(on) =>
              void toggle(
                (value) => ({ ...settings, thought: { ...settings.thought, on: value } }),
                on,
              )
            }
          >
            {settings.thought.on && timeChip('thought')}
          </SwitchRow>
          <SwitchRow
            title={t('reminders.riskHours.title')}
            subtitle={t('reminders.riskHours.subtitle')}
            value={settings.riskHours}
            disabled={!timedMoments && !settings.riskHours}
            onChange={(on) => void toggle((value) => ({ ...settings, riskHours: value }), on)}
          />
          <SwitchRow
            title={t('reminders.ranks.title')}
            subtitle={t('reminders.ranks.subtitle')}
            value={settings.ranks}
            onChange={(on) => void toggle((value) => ({ ...settings, ranks: value }), on)}
          />
        </RowGroup>
        {!timedMoments && (
          <Text style={styles.hint}>
            {t('reminders.riskHours.unavailable', {
              night: t('presets.riskMoments.in-bed-at-night'),
              weekend: t('presets.riskMoments.weekend'),
            })}
          </Text>
        )}
        {notice === 'save-failed' && (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>
            {t('reminders.saveFailed')}
          </Text>
        )}
        {denied && (
          <View style={styles.denied}>
            <Text accessibilityLiveRegion="polite" style={styles.notice}>
              {t('reminders.denied')}
            </Text>
            <Button
              variant="secondary"
              label={t('reminders.openSettings')}
              onPress={() => void Linking.openSettings().catch(() => undefined)}
            />
          </View>
        )}
        <View style={styles.preview}>
          <Text style={styles.label}>{t('reminders.preview')}</Text>
          <NotificationPreview
            text={t('reminders.notifications.check-in')}
            time={formatReminderTime(i18n.language, settings.checkIn.minute, hour12)}
          />
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('reminders.footer')}</Text>
          {Platform.OS === 'ios' && (
            <Text style={styles.footerText}>{t('reminders.iosPreviews')}</Text>
          )}
        </View>
      </ScrollView>
      {editing !== null && (
        <TimeSheet
          visible
          title={t(
            editing.kind === 'checkIn' ? 'reminders.checkIn.title' : 'reminders.thought.title',
          )}
          hour={{
            label: t('reminders.sheet.hour'),
            value: formatReminderTime(i18n.language, editing.minute, hour12),
            decrementLabel: t('reminders.sheet.earlierHour'),
            incrementLabel: t('reminders.sheet.laterHour'),
            onDecrement: () => setEditing({ ...editing, minute: stepMinute(editing.minute, -12) }),
            onIncrement: () => setEditing({ ...editing, minute: stepMinute(editing.minute, 12) }),
          }}
          minute={{
            label: t('reminders.sheet.minute'),
            value: formatReminderTime(i18n.language, editing.minute, hour12),
            decrementLabel: t('reminders.sheet.earlierMinute'),
            incrementLabel: t('reminders.sheet.laterMinute'),
            onDecrement: () => setEditing({ ...editing, minute: stepMinute(editing.minute, -1) }),
            onIncrement: () => setEditing({ ...editing, minute: stepMinute(editing.minute, 1) }),
          }}
          saveLabel={t('reminders.sheet.save')}
          cancelLabel={t('reminders.sheet.cancel')}
          onSave={() => {
            const { kind, minute } = editing;
            setEditing(null);
            void save({ ...settings, [kind]: { ...settings[kind], minute } });
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </Screen>
  );
}

function Header() {
  const { t } = useTranslation();
  return (
    <BackHeader
      backLabel={t('reminders.back')}
      title={t('reminders.title')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.l,
  },
  chip: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.chipHorizontal,
    borderRadius: radii.secondaryButton,
    backgroundColor: colors.separator,
  },
  pressed: {
    opacity: pressedOpacity,
  },
  chipText: {
    ...typography.selectValue,
    color: colors.text,
  },
  hint: {
    ...typography.body,
    color: colors.textSecondary,
  },
  notice: {
    ...typography.body,
    color: colors.text,
  },
  denied: {
    gap: spacing.m,
  },
  preview: {
    gap: spacing.m,
  },
  label: {
    ...typography.sectionLabel,
    paddingHorizontal: spacing.xs,
  },
  footer: {
    gap: spacing.s,
  },
  footerText: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
  },
});

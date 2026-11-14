import { useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { utcToLocal } from '@/domain/local-time';
import { clampStart, defaultPastStart, startBounds } from '@/domain/start-point';
import type { Timestamp } from '@/domain/time';
import { finish, FINISH_ERROR_MESSAGES, type FinishError } from '@/features/onboarding/finish';
import { StepLayout } from '@/features/onboarding/step-layout';
import type { StepProps } from '@/features/onboarding/step-props';
import { Calendar } from '@/features/shared/time-picker/calendar';
import { deviceCalendar, deviceOffsetAt } from '@/features/shared/device-time';
import { formatDateTime } from '@/features/shared/time-picker/format';
import { TimeSteppers } from '@/features/shared/time-picker/time-steppers';
import { useSession } from '@/features/session/session-context';
import { useStorage } from '@/features/storage/storage-context';
import { SegmentedControl } from '@/ui/segmented-control';
import { colors, spacing, typography } from '@/ui/theme';

type StartStepProps = Pick<StepProps, 'answers' | 'onChange' | 'progress' | 'onBack'>;

export function StartStep({ answers, onChange, progress, onBack }: StartStepProps) {
  const { t, i18n } = useTranslation();
  const storage = useStorage();
  const { setJourney } = useSession();
  const [now, setNow] = useState(() => Date.now());
  const [{ firstWeekday, hour12 }] = useState(deviceCalendar);
  const [lastPast, setLastPast] = useState<Timestamp | null>(
    answers.start.kind === 'past' ? answers.start.at : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FinishError | null>(null);
  // State updates land one render later, so a second tap in the same frame still sees busy false.
  const finishing = useRef(false);
  const bounds = startBounds(now);
  const { start } = answers;

  // Going back to "Pick a date" restores the last date picked rather than starting over.
  function chooseKind(kind: 'now' | 'past') {
    setError(null);
    if (kind === 'now') return onChange({ ...answers, start: { kind: 'now' } });
    const current = Date.now();
    const currentBounds = startBounds(current);
    setNow(current);
    const at =
      lastPast === null ? defaultPastStart(currentBounds) : clampStart(lastPast, currentBounds);
    onChange({ ...answers, start: { kind: 'past', at } });
  }

  function choosePast(at: Timestamp) {
    setError(null);
    setLastPast(at);
    onChange({ ...answers, start: { kind: 'past', at } });
  }

  // Android reads the message through its live region; iOS has no live regions, so it is
  // announced there.
  function showError(failure: FinishError) {
    setError(failure);
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(t(FINISH_ERROR_MESSAGES[failure]));
    }
  }

  // The session switches the navigator to the tabs once everything is stored.
  async function submit() {
    if (finishing.current) return;
    finishing.current = true;
    setBusy(true);
    setError(null);
    const result = await finish(storage.onboarding, answers, Date.now());
    if (result.ok) {
      setJourney(result.value);
      return;
    }
    finishing.current = false;
    setBusy(false);
    showError(result.error);
  }

  return (
    <StepLayout
      progress={progress}
      title={t('onboarding.start.title')}
      subtitle={t('onboarding.start.subtitle')}
      onBack={onBack}
      backDisabled={busy}
      action={{ label: t('onboarding.start.finish'), onPress: submit, disabled: busy }}
      footer={
        <>
          {error !== null && (
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
              {t(FINISH_ERROR_MESSAGES[error])}
            </Text>
          )}
          <Text style={styles.caption}>{t('onboarding.start.footer')}</Text>
        </>
      }
    >
      <View style={styles.section}>
        <Text style={styles.label}>{t('onboarding.start.label')}</Text>
        <SegmentedControl
          accessibilityLabel={t('onboarding.start.label')}
          options={[
            { key: 'now', label: t('onboarding.start.now') },
            { key: 'past', label: t('onboarding.start.pickDate') },
          ]}
          selected={start.kind}
          onSelect={chooseKind}
        />
      </View>
      {start.kind === 'past' && (
        <View style={styles.section}>
          <Text accessibilityLiveRegion="polite" style={styles.selected}>
            {t('onboarding.start.selected', {
              date: formatDateTime(i18n.language, utcToLocal(start.at, deviceOffsetAt), hour12),
            })}
          </Text>
          <Calendar
            selected={start.at}
            bounds={bounds}
            offsetAt={deviceOffsetAt}
            firstWeekday={firstWeekday}
            onSelect={choosePast}
          />
          <TimeSteppers
            selected={start.at}
            bounds={bounds}
            offsetAt={deviceOffsetAt}
            hour12={hour12}
            onSelect={choosePast}
          />
        </View>
      )}
    </StepLayout>
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
  selected: {
    ...typography.row,
    color: colors.text,
  },
  error: {
    ...typography.body,
    textAlign: 'center',
    color: colors.text,
  },
  caption: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.textSecondary,
  },
});

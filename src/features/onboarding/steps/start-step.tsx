import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { CreateJourneyError } from '@/domain/journey';
import { utcToLocal } from '@/domain/local-time';
import { finishOnboarding } from '@/domain/onboarding';
import { defaultPastStart, startBounds } from '@/domain/start-point';
import { useSession } from '@/features/session/session-context';
import { StepLayout } from '@/features/onboarding/step-layout';
import type { StepProps } from '@/features/onboarding/step-props';
import { Calendar } from '@/features/onboarding/start-picker/calendar';
import { deviceCalendar, deviceOffsetAt } from '@/features/onboarding/start-picker/device-time';
import { formatDateTime } from '@/features/onboarding/start-picker/format';
import { TimeSteppers } from '@/features/onboarding/start-picker/time-steppers';
import { useStorage } from '@/features/storage/storage-context';
import { SegmentedControl } from '@/ui/segmented-control';
import { colors, typography } from '@/ui/theme';

type FinishError = CreateJourneyError | 'save-failed';

export function StartStep({ answers, onChange, progress, onBack }: Omit<StepProps, 'onContinue'>) {
  const { t, i18n } = useTranslation();
  const storage = useStorage();
  const { setJourney } = useSession();
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FinishError | null>(null);
  const bounds = startBounds(now);
  const { firstWeekday, hour12 } = deviceCalendar();
  const { start } = answers;

  function chooseKind(kind: 'now' | 'past') {
    setError(null);
    if (kind === 'now') return onChange({ ...answers, start: { kind: 'now' } });
    const current = Date.now();
    setNow(current);
    onChange({ ...answers, start: { kind: 'past', at: defaultPastStart(startBounds(current)) } });
  }

  function choosePast(at: number) {
    setError(null);
    onChange({ ...answers, start: { kind: 'past', at } });
  }

  // The journey, the answers and the end of the draft are written in one transaction; the
  // session then switches the navigator to the tabs.
  async function finish() {
    setBusy(true);
    setError(null);
    const result = finishOnboarding(answers, Date.now());
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }
    const saved = await storage.onboarding.complete(result.value);
    if (!saved.ok) {
      setError('save-failed');
      setBusy(false);
      return;
    }
    setJourney(result.value.journey);
  }

  return (
    <StepLayout
      progress={progress}
      title={t('onboarding.start.title')}
      subtitle={t('onboarding.start.subtitle')}
      onBack={onBack}
      action={{ label: t('onboarding.start.finish'), onPress: finish, disabled: busy }}
      footer={
        <>
          {error !== null && (
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
              {t(`onboarding.start.errors.${error}`)}
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
    gap: 12,
  },
  label: {
    ...typography.label,
    paddingHorizontal: 4,
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

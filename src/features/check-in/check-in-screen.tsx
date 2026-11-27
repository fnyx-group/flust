import { useRouter, usePreventRemove } from 'expo-router';
import { useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { todaysCheckIn, URGE_LEVELS, type Mood, type UrgeLevel } from '@/domain/check-in';
import { localDayNumber } from '@/domain/local-time';
import { RISK_MOMENT_IDS, toggleRiskMoment, type RiskMomentId } from '@/domain/presets';
import { ClockContext, useClock } from '@/features/clock/clock-context';
import { createMinuteClock } from '@/features/clock/minute-clock';
import { nativeClockDeps } from '@/features/clock/native-clock';
import { checkInDate, moodOptions } from '@/features/check-in/labels';
import { NoteField } from '@/features/check-in/note-field';
import {
  draftOf,
  isComplete,
  saveCheckIn,
  SAVE_CHECK_IN_ERROR_MESSAGES,
  type CheckInDraft,
  type SaveCheckInError,
} from '@/features/check-in/save-check-in';
import { useSession } from '@/features/session/session-context';
import { deviceOffsetAt } from '@/features/shared/device-time';
import { riskMomentLabel } from '@/features/shared/preset-labels';
import { useStorage } from '@/features/storage/storage-context';
import { Button } from '@/ui/button';
import { ChipList } from '@/ui/chip-list';
import { IconButton } from '@/ui/icon-button';
import { BackIcon } from '@/ui/icons/back-icon';
import { ScalePicker } from '@/ui/scale-picker';
import { KeyboardScreen } from '@/ui/keyboard-screen';
import { PrivateLine } from '@/ui/private-line';
import { ScreenTitle } from '@/ui/screen-title';
import { SectionLabel } from '@/ui/section-label';
import { SegmentedControl } from '@/ui/segmented-control';
import { colors, spacing, typography } from '@/ui/theme';

// Ticks fall on the minute; the date only changes at local midnight.
const CLOCK_ANCHOR = 0;

// Opening the screen again the same local day loads the answers saved that day. Saving is only
// possible once a mood and an urge level are chosen, and the screen cannot be removed while it
// saves. Nothing on it reads or mentions lapses.
export function CheckInScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const storage = useStorage();
  const { checkIns, setCheckIn } = useSession();
  const [clock] = useState(() => createMinuteClock(CLOCK_ANCHOR, nativeClockDeps));
  const [draft, setDraft] = useState<CheckInDraft>(() =>
    draftOf(todaysCheckIn(checkIns, localDayNumber(Date.now(), deviceOffsetAt))),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SaveCheckInError | null>(null);
  // State updates land one render later, so a second tap in the same frame still sees busy false.
  const saving = useRef(false);
  const allowRemove = usePreventRemove(busy);

  function change(next: Partial<CheckInDraft>) {
    setError(null);
    setDraft((previous) => ({ ...previous, ...next }));
  }

  // Android reads the message through its live region; iOS has no live regions, so it is
  // announced there.
  function showError(failure: SaveCheckInError) {
    setError(failure);
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(t(SAVE_CHECK_IN_ERROR_MESSAGES[failure]));
    }
  }

  async function save() {
    if (saving.current || !isComplete(draft)) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    const result = await saveCheckIn(storage.checkIns, draft, Date.now(), deviceOffsetAt);
    // busy drives usePreventRemove: it turns false in the same handler as allowRemove, so the
    // prop and the prevention state stay in sync. saving stays set, so no second save starts.
    if (result.ok) {
      setCheckIn(result.value);
      setBusy(false);
      allowRemove();
      router.back();
      return;
    }
    saving.current = false;
    setBusy(false);
    showError(result.error);
  }

  return (
    <ClockContext value={clock}>
      <KeyboardScreen
        contentContainerStyle={styles.content}
        header={
          <View style={styles.header}>
            <IconButton
              accessibilityLabel={t('checkIn.back')}
              disabled={busy}
              onPress={() => router.back()}
            >
              <BackIcon color={colors.text} size={20} />
            </IconButton>
            <CheckInDate />
          </View>
        }
        footer={
          <View style={styles.footer}>
            {error !== null && (
              <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
                {t(SAVE_CHECK_IN_ERROR_MESSAGES[error])}
              </Text>
            )}
            <PrivateLine text={t('checkIn.private')} />
            <Button
              label={t('checkIn.save')}
              onPress={() => void save()}
              disabled={busy || !isComplete(draft)}
            />
          </View>
        }
      >
        <ScreenTitle>{t('checkIn.title')}</ScreenTitle>
        <View style={styles.field}>
          <SectionLabel color={colors.accentText}>{t('checkIn.mood')}</SectionLabel>
          <ScalePicker
            accessibilityLabel={t('checkIn.mood')}
            options={moodOptions(t)}
            selected={draft.mood}
            onSelect={(mood: Mood) => change({ mood })}
            lowLabel={t('checkIn.moodLow')}
            highLabel={t('checkIn.moodHigh')}
          />
        </View>
        <View style={styles.field}>
          <SectionLabel color={colors.gold}>{t('checkIn.urge')}</SectionLabel>
          <SegmentedControl
            accessibilityLabel={t('checkIn.urge')}
            color={colors.gold}
            options={URGE_LEVELS.map((key) => ({
              key,
              label: t(`checkIn.urgeLevels.${key}`),
            }))}
            selected={draft.urge}
            onSelect={(urge: UrgeLevel) => change({ urge })}
          />
        </View>
        <View style={styles.field}>
          <SectionLabel color={colors.teal}>{t('checkIn.context')}</SectionLabel>
          <ChipList
            color={colors.teal}
            items={RISK_MOMENT_IDS.map((id) => ({
              key: id,
              label: riskMomentLabel(t, id),
              selected: draft.context.includes(id),
            }))}
            onToggle={(id: RiskMomentId) =>
              change({ context: toggleRiskMoment(draft.context, id) })
            }
          />
        </View>
        <NoteField value={draft.note} onChangeText={(note) => change({ note })} />
      </KeyboardScreen>
    </ClockContext>
  );
}

// A component of its own, so that the clock ticks it subscribes to re-render nothing else.
function CheckInDate() {
  const { i18n } = useTranslation();
  const day = useClock((now) => localDayNumber(now, deviceOffsetAt));
  return <Text style={styles.date}>{checkInDate(i18n.language, day)}</Text>;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.l,
    marginBottom: spacing.xl,
  },
  date: {
    ...typography.bodyLarge,
    flexShrink: 1,
    textAlign: 'right',
    color: colors.textSecondary,
  },
  content: {
    gap: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  field: {
    gap: spacing.m,
  },
  footer: {
    gap: spacing.m,
    paddingTop: spacing.m,
  },
  error: {
    ...typography.body,
    textAlign: 'center',
    color: colors.text,
  },
});

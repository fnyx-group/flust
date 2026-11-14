import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Profile } from '@/data/profile-repository';
import type { Journey } from '@/domain/journey';
import { defaultEarlierLapse, lapseBounds, lapseSummary } from '@/domain/lapse';
import { DEFAULT_PLAN, type Plan } from '@/domain/onboarding';
import { PLACE_IDS, RISK_MOMENT_IDS, type PlaceId, type RiskMomentId } from '@/domain/presets';
import { clampStart } from '@/domain/start-point';
import type { Timestamp } from '@/domain/time';
import { lapseTriggers } from '@/features/lapse/labels';
import {
  recordLapse,
  RECORD_LAPSE_ERROR_MESSAGES,
  skippedAnswers,
  type LapseAnswers,
  type RecordLapseError,
} from '@/features/lapse/record-lapse';
import { SummaryCards } from '@/features/lapse/summary-cards';
import { WhenField } from '@/features/lapse/when-field';
import { useSession } from '@/features/session/session-context';
import { PlanFields } from '@/features/shared/plan-fields';
import { placeLabel, riskMomentLabel } from '@/features/shared/preset-labels';
import { useStorage } from '@/features/storage/storage-context';
import { Button } from '@/ui/button';
import { ChipList } from '@/ui/chip-list';
import { IconButton } from '@/ui/icon-button';
import { BackIcon } from '@/ui/icons/back-icon';
import { OptionSheet } from '@/ui/option-sheet';
import { Screen } from '@/ui/screen';
import { ScreenTitle } from '@/ui/screen-title';
import { ScrollView } from '@/ui/scroll-view';
import { SelectRow } from '@/ui/select-row';
import { colors, spacing, typography } from '@/ui/theme';

export function LapseScreen() {
  const { journey } = useSession();
  // The route is only reachable once a journey exists.
  if (journey === null) return null;
  return <Lapse journey={journey} />;
}

// Every question is optional. "Skip" and "Save" both log the lapse; skipping keeps only the time,
// and going back logs nothing. The screen closes only once the lapse is stored.
function Lapse({ journey }: { journey: Journey }) {
  const { t } = useTranslation();
  const storage = useStorage();
  const { unlockedRanks, setLapses } = useSession();
  const [now, setNow] = useState(() => Date.now());
  const [earlier, setEarlier] = useState<Timestamp | null>(null);
  const [lastEarlier, setLastEarlier] = useState<Timestamp | null>(null);
  const [place, setPlace] = useState<PlaceId | null>(null);
  const [context, setContext] = useState<readonly RiskMomentId[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [choosingPlace, setChoosingPlace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<RecordLapseError | null>(null);
  // State updates land one render later, so a second tap in the same frame still sees busy false.
  const saving = useRef(false);

  useEffect(() => {
    let active = true;
    storage.profile.load().then((result) => {
      if (!active) return;
      const loaded = result.ok ? result.value : { reasons: [], riskMoments: [], plans: [] };
      setProfile(loaded);
      setPlan(loaded.plans[0] ?? DEFAULT_PLAN);
    });
    return () => {
      active = false;
    };
  }, [storage]);

  const bounds = lapseBounds(journey, now);
  const summary = lapseSummary(journey, earlier ?? now, unlockedRanks, now);
  const currentPlan = profile?.plans[0] ?? DEFAULT_PLAN;

  function chooseNow() {
    setError(null);
    setEarlier(null);
  }

  // Going back to "Earlier" restores the last time picked rather than starting over.
  function chooseEarlier() {
    setError(null);
    const current = Date.now();
    const currentBounds = lapseBounds(journey, current);
    setNow(current);
    if (currentBounds === null) return;
    setEarlier(
      lastEarlier === null
        ? defaultEarlierLapse(currentBounds)
        : clampStart(lastEarlier, currentBounds),
    );
  }

  function selectEarlier(at: Timestamp) {
    setError(null);
    setEarlier(at);
    setLastEarlier(at);
  }

  function toggleContext(id: RiskMomentId) {
    const next = context.includes(id) ? context.filter((other) => other !== id) : [...context, id];
    setContext(RISK_MOMENT_IDS.filter((moment) => next.includes(moment)));
  }

  // Android reads the message through its live region; iOS has no live regions, so it is
  // announced there.
  function showError(failure: RecordLapseError) {
    setError(failure);
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(t(RECORD_LAPSE_ERROR_MESSAGES[failure]));
    }
  }

  async function save(answers: LapseAnswers) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    const result = await recordLapse(storage.lapses, journey, answers, Date.now());
    if (result.ok) {
      router.back();
      setLapses(result.value.journey, result.value.record);
      return;
    }
    saving.current = false;
    setBusy(false);
    showError(result.error);
  }

  function saveAnswers() {
    void save({
      at: earlier,
      details: { place, context },
      plan: plan === null ? null : { current: currentPlan, adjusted: plan },
    });
  }

  return (
    <Screen bottomInset>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <IconButton
            accessibilityLabel={t('lapse.back')}
            disabled={busy}
            onPress={() => router.back()}
          >
            <BackIcon color={colors.text} size={20} />
          </IconButton>
          <View>
            <Button
              variant="plain"
              label={t('lapse.skip')}
              disabled={busy}
              onPress={() => void save(skippedAnswers(earlier))}
            />
          </View>
        </View>
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.intro}>
            <ScreenTitle>{t('lapse.title')}</ScreenTitle>
            <Text style={styles.subtitle}>{t('lapse.subtitle')}</Text>
          </View>
          {summary.ok && <SummaryCards summary={summary.value} />}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('lapse.whatHappened')}</Text>
            <SelectRow
              prefix={t('lapse.where')}
              value={place === null ? t('lapse.notSet') : placeLabel(t, place)}
              accessibilityHint={t('lapse.whereHint')}
              onPress={() => setChoosingPlace(true)}
            />
            <WhenField
              earlier={earlier}
              bounds={bounds}
              onChooseNow={chooseNow}
              onChooseEarlier={chooseEarlier}
              onSelect={selectEarlier}
            />
            <View style={styles.field}>
              <Text style={styles.label}>{t('lapse.context')}</Text>
              <ChipList
                items={RISK_MOMENT_IDS.map((id) => ({
                  key: id,
                  label: riskMomentLabel(t, id),
                  selected: context.includes(id),
                }))}
                onToggle={toggleContext}
              />
            </View>
          </View>
          {profile !== null && plan !== null && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('lapse.nextTime')}</Text>
              <PlanFields
                plan={plan}
                triggers={lapseTriggers(profile.riskMoments, currentPlan.trigger)}
                onChange={setPlan}
              />
            </View>
          )}
        </ScrollView>
        <View style={styles.footer}>
          {error !== null && (
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
              {t(RECORD_LAPSE_ERROR_MESSAGES[error])}
            </Text>
          )}
          <Button label={t('lapse.save')} onPress={saveAnswers} disabled={busy} />
        </View>
      </KeyboardAvoidingView>
      <OptionSheet
        visible={choosingPlace}
        title={t('lapse.whereTitle')}
        closeLabel={t('onboarding.close')}
        options={PLACE_IDS.map((id) => ({ key: id, label: placeLabel(t, id) }))}
        selected={place}
        onSelect={setPlace}
        onClose={() => setChoosingPlace(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  content: {
    gap: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  intro: {
    gap: spacing.s,
  },
  subtitle: {
    ...typography.bodyLarge,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  section: {
    gap: spacing.l,
  },
  sectionLabel: {
    ...typography.sectionLabel,
    color: colors.text,
  },
  field: {
    gap: spacing.m,
  },
  label: {
    ...typography.label,
    paddingHorizontal: spacing.xs,
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

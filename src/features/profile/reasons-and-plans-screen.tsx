import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ProfileEntries } from '@/data/profile-repository';
import { RISK_MOMENT_IDS, toggleRiskMoment, type RiskMomentId } from '@/domain/presets';
import { canAddPlan, canAddReason, MAX_PLANS, MAX_REASONS } from '@/domain/profile';
import { EntriesUnavailable } from '@/features/profile/entries-unavailable';
import { reasonText } from '@/features/profile/labels';
import { useProfileEntries } from '@/features/profile/use-profile-entries';
import { planSentence, riskMomentLabel } from '@/features/shared/preset-labels';
import { useStorage } from '@/features/storage/storage-context';
import { BackHeader } from '@/ui/back-header';
import { ChipList } from '@/ui/chip-list';
import { AddRow, NavRow } from '@/ui/nav-row';
import { RowGroup } from '@/ui/row-group';
import { Screen } from '@/ui/screen';
import { ScrollView } from '@/ui/scroll-view';
import { SectionLabel } from '@/ui/section-label';
import { colors, spacing, typography } from '@/ui/theme';

export function ReasonsAndPlansScreen() {
  const { t } = useTranslation();
  const storage = useStorage();
  const { state, update, retry } = useProfileEntries(storage.profile);
  if (state.status === 'loading') return <EntriesUnavailable message={null} />;
  if (state.status === 'failed') {
    return <EntriesUnavailable message={t('profile.loadFailed')} onRetry={retry} />;
  }
  return <ReasonsAndPlans entries={state.entries} update={update} />;
}

type Notice = 'reason-limit' | 'plan-limit' | 'save-failed' | null;

type ReasonsAndPlansProps = {
  entries: ProfileEntries;
  update: (change: (entries: ProfileEntries) => ProfileEntries) => void;
};

// Reasons and plans open their own screen. Risk moments are saved as they are toggled, like the
// chips of the onboarding. Adding beyond a limit says so where the user tapped, calmly.
function ReasonsAndPlans({ entries, update }: ReasonsAndPlansProps) {
  const { t } = useTranslation();
  const storage = useStorage();
  const [notice, setNotice] = useState<Notice>(null);

  function show(next: Exclude<Notice, null>) {
    setNotice(next);
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(noticeText(next));
  }

  function noticeText(kind: Exclude<Notice, null>): string {
    if (kind === 'reason-limit') return t('profile.reasonLimit', { count: MAX_REASONS });
    if (kind === 'plan-limit') return t('profile.planLimit', { count: MAX_PLANS });
    return t('profile.saveFailed');
  }

  function noticeFor(kind: Exclude<Notice, null>): string | null {
    return notice === kind ? noticeText(kind) : null;
  }

  function addReason() {
    if (!canAddReason(entries.reasons)) return show('reason-limit');
    setNotice(null);
    router.push('/reason');
  }

  function addPlan() {
    if (!canAddPlan(entries.plans)) return show('plan-limit');
    setNotice(null);
    router.push('/plan');
  }

  // Shown at once and saved after. A failed save puts back what is stored, read again.
  async function toggleMoment(id: RiskMomentId) {
    setNotice(null);
    const next = toggleRiskMoment(entries.riskMoments, id);
    update((previous) => ({ ...previous, riskMoments: next }));
    const saved = await storage.profile.saveRiskMoments(next);
    if (saved.ok) return;
    show('save-failed');
    const stored = await storage.profile.loadEntries();
    if (stored.ok) update((previous) => ({ ...previous, riskMoments: stored.value.riskMoments }));
  }

  return (
    <Screen bottomInset>
      <BackHeader
        backLabel={t('profile.back')}
        title={t('profile.title')}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section
          label={t('profile.reasons')}
          color={colors.accentText}
          notice={noticeFor('reason-limit')}
        >
          <RowGroup>
            {entries.reasons.map(({ id, reason }) => (
              <NavRow
                key={id}
                label={reasonText(t, reason)}
                accessibilityHint={t('profile.editReasonHint')}
                onPress={() => router.push({ pathname: '/reason', params: { id: String(id) } })}
              />
            ))}
            <AddRow label={t('profile.addReason')} onPress={addReason} />
          </RowGroup>
        </Section>
        <Section
          label={t('profile.riskMoments')}
          color={colors.gold}
          notice={noticeFor('save-failed')}
        >
          <ChipList
            color={colors.gold}
            items={RISK_MOMENT_IDS.map((id) => ({
              key: id,
              label: riskMomentLabel(t, id),
              selected: entries.riskMoments.includes(id),
            }))}
            onToggle={(id) => void toggleMoment(id)}
          />
        </Section>
        <Section label={t('profile.plans')} color={colors.teal} notice={noticeFor('plan-limit')}>
          <RowGroup>
            {entries.plans.map(({ id, plan }) => (
              <NavRow
                key={id}
                label={planSentence(t, plan)}
                accessibilityHint={t('profile.editPlanHint')}
                onPress={() => router.push({ pathname: '/plan', params: { id: String(id) } })}
              />
            ))}
            <AddRow label={t('profile.addPlan')} onPress={addPlan} />
          </RowGroup>
        </Section>
        <Text style={styles.footer}>{t('profile.footer')}</Text>
      </ScrollView>
    </Screen>
  );
}

function Section({
  label,
  color,
  notice,
  children,
}: {
  label: string;
  color: string;
  notice: string | null;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <SectionLabel color={color}>{label}</SectionLabel>
      {children}
      {notice !== null && (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>
          {notice}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  section: {
    gap: spacing.m,
  },
  notice: {
    ...typography.body,
    color: colors.text,
    paddingHorizontal: spacing.xs,
  },
  footer: {
    ...typography.body,
    color: colors.textSecondary,
  },
});

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { filterView } from '@/domain/filter-state';
import { turnYoutubeStrictOn } from '@/features/filter/filter-actions';
import { FilterDisclosureSheet } from '@/features/filter/filter-disclosure-sheet';
import { FilterMeasure } from '@/features/filter/filter-measure';
import { filterBridge, filterMeasureOn } from '@/features/filter/filter-native';
import { FilterStatusBlock } from '@/features/filter/filter-status-block';
import { confirmTitle } from '@/features/filter/labels';
import { useEnableFilter } from '@/features/filter/use-enable-filter';
import { useFilterRequest } from '@/features/filter/use-filter-request';
import { useFilterStatus } from '@/features/filter/use-filter-status';
import { BackHeader } from '@/ui/back-header';
import { ConfirmSheet } from '@/ui/confirm-sheet';
import { DocumentIcon } from '@/ui/icons/document-icon';
import { SettingsIcon } from '@/ui/icons/settings-icon';
import { ShieldIcon } from '@/ui/icons/shield-icon';
import { NavRow } from '@/ui/nav-row';
import { RowGroup } from '@/ui/row-group';
import { Screen } from '@/ui/screen';
import { ScrollView } from '@/ui/scroll-view';
import { SwitchRow } from '@/ui/switch-row';
import { colors, spacing, typography } from '@/ui/theme';

// Android's own settings screens, opened by intent: flust cannot change them itself.
const VPN_SETTINGS = 'android.settings.VPN_SETTINGS';
const NETWORK_SETTINGS = 'android.settings.WIRELESS_SETTINGS';

// Two switches only: anything more would be a way to weaken the filter in a weak moment
// (docs/decisions/0038-content-filter.md). Turning either on is immediate; turning either off
// waits 20 minutes, then asks once more (docs/decisions/0040-filter-delay.md).
export function FilterScreen() {
  const { t } = useTranslation();
  const { status, refresh } = useFilterStatus({ poll: true });
  const { pending, ask, cancel, confirm } = useFilterRequest(refresh);
  const enabling = useEnableFilter(refresh);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const enabled = status.available && status.enabled;
  const youtubeStrict = status.available && status.youtubeStrict;

  // A request about something that is already off has nothing left to wait for.
  useEffect(() => {
    if (pending === null || !status.available) return;
    if (!status.enabled || (pending.kind === 'youtube' && !status.youtubeStrict)) cancel();
  }, [pending, status, cancel]);

  if (!status.available) return null;
  const view = filterView(status);
  if (view.state === 'unavailable') return null;

  async function strengthenYoutube() {
    setBusy(true);
    if (pending?.kind === 'youtube') cancel();
    await turnYoutubeStrictOn(filterBridge);
    refresh();
    setBusy(false);
  }

  function changeFilter(on: boolean) {
    if (on) void enabling.enable(youtubeStrict);
    else ask('filter');
  }

  function changeYoutube(on: boolean) {
    if (on) void strengthenYoutube();
    else ask('youtube');
  }

  async function confirmRequest() {
    setConfirming(false);
    await confirm();
  }

  function open(action: string) {
    Linking.sendIntent(action).catch(() => undefined);
  }

  const working = busy || enabling.busy;
  return (
    <Screen bottomInset>
      <BackHeader
        backLabel={t('filter.back')}
        title={t('filter.title')}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FilterStatusBlock
          view={view}
          pending={pending}
          busy={working}
          onEnable={() => void enabling.enable(youtubeStrict)}
          onNetworkSettings={() => open(NETWORK_SETTINGS)}
          onCancelRequest={cancel}
          onConfirmRequest={() => setConfirming(true)}
        />
        {enabling.notice !== null && (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>
            {t(`filter.${enabling.notice}`)}
          </Text>
        )}
        <RowGroup>
          <SwitchRow
            title={t('filter.filter')}
            value={enabled}
            disabled={working || pending?.kind === 'filter'}
            icon={{ icon: ShieldIcon, color: colors.teal }}
            onChange={changeFilter}
          />
          <SwitchRow
            title={t('filter.youtubeStrict')}
            subtitle={t('filter.youtubeStrictHint')}
            value={youtubeStrict}
            disabled={working || !enabled || pending !== null}
            onChange={changeYoutube}
          />
        </RowGroup>
        <View style={styles.notes}>
          <Text style={styles.note}>{t('filter.blocks')}</Text>
          <Text style={styles.note}>{t('filter.quad9')}</Text>
          <Text style={styles.note}>{t('filter.chrome')}</Text>
        </View>
        <RowGroup>
          <NavRow
            label={t('filter.alwaysOn')}
            icon={{ icon: SettingsIcon, color: colors.textSecondary }}
            onPress={() => open(VPN_SETTINGS)}
          />
          <NavRow
            label={t('filter.licenses')}
            icon={{ icon: DocumentIcon, color: colors.textSecondary }}
            onPress={() => router.push('/licenses')}
          />
        </RowGroup>
        <Text style={styles.note}>{t('filter.alwaysOnHint')}</Text>
        {filterMeasureOn() && <FilterMeasure />}
      </ScrollView>
      <FilterDisclosureSheet
        visible={enabling.disclosing}
        onAccept={() => void enabling.accept(youtubeStrict)}
        onDecline={enabling.decline}
      />
      {pending !== null && (
        <ConfirmSheet
          visible={confirming && pending.phase === 'confirm'}
          title={confirmTitle(t, pending)}
          message={t('filter.request.confirmMessage')}
          confirmLabel={t('filter.request.confirm')}
          cancelLabel={t('filter.request.keep')}
          onConfirm={() => void confirmRequest()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.l,
  },
  notice: {
    ...typography.body,
    color: colors.text,
  },
  notes: {
    gap: spacing.m,
  },
  note: {
    ...typography.paragraph,
    color: colors.textSecondary,
  },
});

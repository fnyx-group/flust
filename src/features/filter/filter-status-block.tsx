import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { FilterView } from '@/domain/filter-state';
import {
  filterStatusLine,
  reasonAction,
  reasonActionLabel,
  reasonText,
  requestLine,
} from '@/features/filter/labels';
import type { PendingRequest } from '@/features/filter/use-filter-request';
import { Button } from '@/ui/button';
import { ShieldIcon } from '@/ui/icons/shield-icon';
import { IconTile } from '@/ui/icon-tile';
import { colors, radii, spacing, typography } from '@/ui/theme';

type FilterStatusBlockProps = {
  view: Exclude<FilterView, { state: 'unavailable' }>;
  pending: PendingRequest | null;
  busy: boolean;
  onEnable: () => void;
  onNetworkSettings: () => void;
  onCancelRequest: () => void;
  onConfirmRequest: () => void;
};

// The top of the filter screen: whether it protects, why not and what to do, and the request to
// weaken it while it waits. Nothing here is red: none of it destroys anything.
export function FilterStatusBlock({
  view,
  pending,
  busy,
  onEnable,
  onNetworkSettings,
  onCancelRequest,
  onConfirmRequest,
}: FilterStatusBlockProps) {
  const { t } = useTranslation();
  const action = view.state === 'inactive' ? reasonAction(view.reason) : null;
  const line = pending === null ? null : requestLine(t, pending);
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <IconTile icon={ShieldIcon} color={view.state === 'on' ? colors.teal : colors.muted} />
        <Text accessibilityLiveRegion="polite" style={styles.status}>
          {filterStatusLine(t, view)}
        </Text>
      </View>
      {view.state === 'inactive' && (
        <Text accessibilityLiveRegion="polite" style={styles.text}>
          {reasonText(t, view.reason)}
        </Text>
      )}
      {view.state === 'inactive' && view.reason !== 'lists' && action !== null && (
        <Button
          variant="secondary"
          label={reasonActionLabel(t, view.reason)}
          disabled={busy}
          onPress={action === 'enable' ? onEnable : onNetworkSettings}
        />
      )}
      {pending !== null && line !== null && (
        <View style={styles.request}>
          <Text accessibilityLiveRegion="polite" style={styles.requestLine}>
            {line}
          </Text>
          {pending.phase === 'waiting' && (
            <Text style={styles.text}>{t('filter.request.why')}</Text>
          )}
          {pending.phase === 'confirm' && (
            <Button
              label={t('filter.request.confirmOpen')}
              variant="secondary"
              onPress={onConfirmRequest}
            />
          )}
          <Button label={t('filter.request.cancel')} variant="plain" onPress={onCancelRequest} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.l,
    padding: spacing.card,
    borderRadius: radii.cardLarge,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.l,
  },
  status: {
    ...typography.row,
    flex: 1,
    color: colors.text,
  },
  text: {
    ...typography.paragraph,
    color: colors.textSecondary,
  },
  request: {
    gap: spacing.m,
  },
  requestLine: {
    ...typography.row,
    color: colors.text,
  },
});

import type { TFunction } from 'i18next';

import type { FilterInactiveReason, FilterView } from '@/domain/filter-state';
import { MS_PER_MINUTE, MS_PER_SECOND } from '@/domain/time';
import type { FilterNotificationWords } from '@/features/filter/filter-bridge';
import type { PendingRequest } from '@/features/filter/use-filter-request';

type ShownView = Exclude<FilterView, { state: 'unavailable' }>;

// Neutral on purpose, like the reminders: nothing in the notification says what flust is for.
export function filterNotificationWords(t: TFunction): FilterNotificationWords {
  return {
    channelName: t('filter.notification.channelName'),
    text: t('filter.notification.text'),
  };
}

export function filterValue(t: TFunction, view: ShownView): string {
  return t(`filter.value.${view.state}`);
}

export function filterStatusLine(t: TFunction, view: ShownView): string {
  return t(`filter.status.${view.state}`);
}

// What to do next: nothing for lists that cannot be read, which only an update or a new install
// brings back.
export type ReasonAction = 'enable' | 'network-settings' | null;

export function reasonAction(reason: FilterInactiveReason): ReasonAction {
  if (reason === 'lists') return null;
  return reason === 'private-dns' ? 'network-settings' : 'enable';
}

export function reasonText(t: TFunction, reason: FilterInactiveReason): string {
  return t(`filter.inactive.${reason}.text`);
}

export function reasonActionLabel(
  t: TFunction,
  reason: Exclude<FilterInactiveReason, 'lists'>,
): string {
  return t(`filter.inactive.${reason}.action`);
}

// Seconds under a minute, then whole minutes rounded up, like the lock wait.
export function remainingLabel(t: TFunction, ms: number): string {
  return ms < MS_PER_MINUTE
    ? t('filter.request.seconds', { count: Math.ceil(ms / MS_PER_SECOND) })
    : t('filter.request.minutes', { count: Math.ceil(ms / MS_PER_MINUTE) });
}

export function requestLine(t: TFunction, pending: PendingRequest): string | null {
  if (pending.phase === 'waiting') {
    return t(`filter.request.${pending.kind}`, { time: remainingLabel(t, pending.waitMs) });
  }
  if (pending.phase === 'confirm') {
    return t('filter.request.ready', { time: remainingLabel(t, pending.confirmMs) });
  }
  return null;
}

export function confirmTitle(t: TFunction, pending: PendingRequest): string {
  return pending.kind === 'filter'
    ? t('filter.request.confirmFilterTitle')
    : t('filter.request.confirmYoutubeTitle');
}

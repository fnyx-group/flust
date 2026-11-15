import type { TFunction } from 'i18next';

import type { LockSettings } from '@/domain/lock';
import { MS_PER_HOUR, MS_PER_MINUTE, MS_PER_SECOND } from '@/domain/time';
import type { DeviceSecurity } from '@/features/lock/local-auth';

type Platform = 'ios' | 'android' | string;

type Method = 'passcode' | 'faceId' | 'touchId' | 'face' | 'fingerprint' | 'iris';

type DelayKey =
  | 'lock.delays.0'
  | 'lock.delays.60000'
  | 'lock.delays.300000'
  | 'lock.delays.900000'
  | 'lock.delays.3600000';

const DELAY_LABELS: Readonly<Record<number, DelayKey>> = {
  0: 'lock.delays.0',
  [MS_PER_MINUTE]: 'lock.delays.60000',
  [5 * MS_PER_MINUTE]: 'lock.delays.300000',
  [15 * MS_PER_MINUTE]: 'lock.delays.900000',
  [MS_PER_HOUR]: 'lock.delays.3600000',
};

// Apple's names on iOS, plain words on Android, where each maker names them its own way.
function methodKey(security: DeviceSecurity, platform: Platform): Method {
  if (security.kind !== 'biometric') return 'passcode';
  if (platform === 'ios' && security.biometric === 'face') return 'faceId';
  if (platform === 'ios' && security.biometric === 'fingerprint') return 'touchId';
  return security.biometric;
}

// "Lock with Face ID" when the device has one method to name, else "Lock flust".
export function lockToggleLabel(
  t: TFunction,
  security: DeviceSecurity,
  platform: Platform,
): string {
  if (security.kind === 'none') return t('lock.settings.toggle');
  return t('lock.settings.toggleWith', {
    method: t(`lock.methods.${methodKey(security, platform)}`),
  });
}

export function lockValue(
  t: TFunction,
  settings: LockSettings,
  security: DeviceSecurity,
  platform: Platform,
): string {
  if (!settings.enabled) return t('lock.values.off');
  if (security.kind === 'none') return t('lock.values.paused');
  return t(`lock.values.${methodKey(security, platform)}`);
}

export function delayLabel(t: TFunction, delay: number): string {
  const key = DELAY_LABELS[delay];
  return key === undefined ? '' : t(key);
}

// Seconds under a minute, then whole minutes rounded up, so the wait never reads as over early.
export function waitLabel(t: TFunction, waitMs: number): string {
  if (waitMs < MS_PER_MINUTE) {
    return t('lock.wait', {
      time: t('lock.waitSeconds', { count: Math.ceil(waitMs / MS_PER_SECOND) }),
    });
  }
  return t('lock.wait', {
    time: t('lock.waitMinutes', { count: Math.ceil(waitMs / MS_PER_MINUTE) }),
  });
}

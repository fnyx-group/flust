import {
  authenticateAsync,
  AuthenticationType,
  getEnrolledLevelAsync,
  SecurityLevel,
  supportedAuthenticationTypesAsync,
} from 'expo-local-authentication';

import { outcomeOf, type AuthOutcome } from '@/features/lock/auth-outcome';

export type Biometric = 'face' | 'fingerprint' | 'iris';

// What the device can unlock with. The lock needs at least a passcode: with no screen lock,
// anyone holding the phone could pass it.
export type DeviceSecurity =
  | { readonly kind: 'none' }
  | { readonly kind: 'passcode' }
  | { readonly kind: 'biometric'; readonly biometric: Biometric };

const BIOMETRICS: readonly [AuthenticationType, Biometric][] = [
  [AuthenticationType.FACIAL_RECOGNITION, 'face'],
  [AuthenticationType.FINGERPRINT, 'fingerprint'],
  [AuthenticationType.IRIS, 'iris'],
];

export async function deviceSecurity(): Promise<DeviceSecurity> {
  try {
    const level = await getEnrolledLevelAsync();
    if (level === SecurityLevel.NONE) return { kind: 'none' };
    if (level === SecurityLevel.SECRET) return { kind: 'passcode' };
    const types = await supportedAuthenticationTypesAsync();
    const biometric = BIOMETRICS.find(([type]) => types.includes(type))?.[1];
    return biometric === undefined ? { kind: 'passcode' } : { kind: 'biometric', biometric };
  } catch {
    return { kind: 'none' };
  }
}

export type AuthLabels = { readonly prompt: string; readonly cancel: string };

// Biometrics with the device passcode as fallback, which the system offers itself.
export async function authenticate(labels: AuthLabels): Promise<AuthOutcome> {
  try {
    const result = await authenticateAsync({
      promptMessage: labels.prompt,
      cancelLabel: labels.cancel,
      disableDeviceFallback: false,
      requireConfirmation: false,
    });
    return outcomeOf(result);
  } catch {
    return 'interrupted';
  }
}

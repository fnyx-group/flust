import type { LocalAuthenticationResult } from 'expo-local-authentication';

// 'interrupted' is the system closing the prompt, for a call or the app leaving the screen: it
// is not the person's attempt, so it never adds to the wait. 'unavailable' means the device has
// no screen lock any more.
export type AuthOutcome =
  'success' | 'failed' | 'cancelled' | 'interrupted' | 'lockout' | 'unavailable';

export function outcomeOf(result: LocalAuthenticationResult): AuthOutcome {
  if (result.success) return 'success';
  switch (result.error) {
    case 'authentication_failed':
    case 'unable_to_process':
      return 'failed';
    case 'user_cancel':
    case 'user_fallback':
    case 'timeout':
      return 'cancelled';
    case 'lockout':
      return 'lockout';
    case 'not_enrolled':
    case 'not_available':
    case 'passcode_not_set':
      return 'unavailable';
    case 'system_cancel':
    case 'app_cancel':
    case 'no_space':
    case 'invalid_context':
    case 'unknown':
      return 'interrupted';
  }
}

export function countsAsAttempt(outcome: AuthOutcome): boolean {
  return outcome === 'failed' || outcome === 'cancelled';
}

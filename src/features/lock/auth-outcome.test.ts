import { countsAsAttempt, outcomeOf } from '@/features/lock/auth-outcome';

describe('outcomeOf', () => {
  it('reads each system answer', () => {
    expect(outcomeOf({ success: true })).toBe('success');
    expect(outcomeOf({ success: false, error: 'authentication_failed' })).toBe('failed');
    expect(outcomeOf({ success: false, error: 'user_cancel' })).toBe('cancelled');
    expect(outcomeOf({ success: false, error: 'lockout' })).toBe('lockout');
    expect(outcomeOf({ success: false, error: 'passcode_not_set' })).toBe('unavailable');
    expect(outcomeOf({ success: false, error: 'system_cancel' })).toBe('interrupted');
    expect(outcomeOf({ success: false, error: 'app_cancel' })).toBe('interrupted');
  });
});

describe('countsAsAttempt', () => {
  it('counts what the person did, never what the system did', () => {
    expect(countsAsAttempt('failed')).toBe(true);
    expect(countsAsAttempt('cancelled')).toBe(true);
    expect(countsAsAttempt('interrupted')).toBe(false);
    expect(countsAsAttempt('lockout')).toBe(false);
    expect(countsAsAttempt('unavailable')).toBe(false);
    expect(countsAsAttempt('success')).toBe(false);
  });
});

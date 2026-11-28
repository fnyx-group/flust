import { FILTER_INACTIVE_REASONS } from '@/domain/filter-state';
import { MS_PER_MINUTE, MS_PER_SECOND } from '@/domain/time';
import {
  confirmTitle,
  filterStatusLine,
  filterValue,
  reasonAction,
  reasonActionLabel,
  reasonText,
  remainingLabel,
  requestLine,
} from '@/features/filter/labels';
import { createI18n } from '@/lib/i18n';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

const english = createI18n('en').t;
const french = createI18n('fr').t;

describe('the filter labels', () => {
  it('name each state', () => {
    expect(filterValue(french, { state: 'on' })).toBe('Activé');
    expect(filterValue(english, { state: 'inactive', reason: 'vpn-off' })).toBe('Inactive');
    expect(filterStatusLine(french, { state: 'off' })).toBe('Le filtre est désactivé.');
  });

  it.each(FILTER_INACTIVE_REASONS)('explain the reason %s and what to do', (reason) => {
    expect(reasonText(french, reason)).not.toContain('filter.');
    const action = reasonAction(reason);
    if (reason !== 'lists') expect(reasonActionLabel(english, reason)).not.toContain('filter.');
    expect(action === null).toBe(reason === 'lists');
  });

  it('send strict Private DNS to the network settings and the rest to turning it back on', () => {
    expect(reasonAction('private-dns')).toBe('network-settings');
    expect(reasonAction('other-vpn')).toBe('enable');
  });

  it('count seconds under a minute, then whole minutes rounded up', () => {
    expect(remainingLabel(french, 45 * MS_PER_SECOND)).toBe('45 s');
    expect(remainingLabel(french, 17 * MS_PER_MINUTE + 1)).toBe('18 min');
  });

  it('say what waits and for how long, then how long is left to confirm', () => {
    expect(
      requestLine(french, { kind: 'filter', phase: 'waiting', waitMs: 18 * MS_PER_MINUTE }),
    ).toBe('Le filtre se désactive dans 18 min.');
    expect(
      requestLine(english, { kind: 'youtube', phase: 'waiting', waitMs: 30 * MS_PER_SECOND }),
    ).toBe('Strict YouTube turns off in 30 s.');
    expect(
      requestLine(english, { kind: 'filter', phase: 'confirm', confirmMs: 9 * MS_PER_MINUTE }),
    ).toBe('Confirm within 9 min, or the request expires.');
    expect(requestLine(english, { kind: 'filter', phase: 'expired' })).toBeNull();
  });

  it('ask about what the request turns off', () => {
    expect(confirmTitle(english, { kind: 'youtube', phase: 'confirm', confirmMs: 1 })).toBe(
      'Turn Strict YouTube off?',
    );
    expect(confirmTitle(french, { kind: 'filter', phase: 'confirm', confirmMs: 1 })).toBe(
      'Désactiver le filtre ?',
    );
  });
});

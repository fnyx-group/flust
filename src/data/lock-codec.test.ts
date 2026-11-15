import * as fc from 'fast-check';

import {
  decodeAttempts,
  decodeLockSettings,
  encodeAttempts,
  encodeLockSettings,
} from '@/data/lock-codec';
import { DEFAULT_LOCK_SETTINGS, LOCK_DELAYS } from '@/domain/lock';
import { MS_PER_HOUR, MS_PER_MINUTE } from '@/domain/time';
import { timestamp } from '@test/arbitraries';

describe('lock settings codec', () => {
  it('reads back what it wrote', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.constantFrom(...LOCK_DELAYS), (enabled, delay) => {
        const settings = { enabled, delay };
        expect(decodeLockSettings(encodeLockSettings(settings))).toEqual(settings);
      }),
    );
  });

  it('is off when nothing is stored', () => {
    expect(decodeLockSettings(null)).toEqual(DEFAULT_LOCK_SETTINGS);
  });

  it.each(['', 'not json', '[]', 'null', '{"enabled":"no"}', '{}'])(
    'keeps the lock on when %p is stored',
    (text) => {
      expect(decodeLockSettings(text).enabled).toBe(true);
    },
  );

  it('turns off only for a clear false', () => {
    expect(decodeLockSettings('{"enabled":false,"delay":0}')).toEqual({ enabled: false, delay: 0 });
  });

  it('falls back to the default delay for one it does not offer', () => {
    expect(decodeLockSettings(`{"enabled":true,"delay":${2 * MS_PER_MINUTE}}`)).toEqual({
      enabled: true,
      delay: DEFAULT_LOCK_SETTINGS.delay,
    });
  });
});

describe('lock attempts codec', () => {
  it('reads back what it wrote', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 100 }),
        fc.nat({ max: MS_PER_HOUR }),
        timestamp,
        (failures, waitMs, savedAt) => {
          const saved = { attempts: { failures, waitMs }, savedAt };
          expect(decodeAttempts(encodeAttempts(saved))).toEqual(saved);
        },
      ),
    );
  });

  it.each([
    null,
    'not json',
    '{}',
    '{"failures":-1,"waitMs":0,"savedAt":0}',
    '{"failures":1,"waitMs":1.5,"savedAt":0}',
    `{"failures":1,"waitMs":${MS_PER_HOUR + 1},"savedAt":0}`,
    '{"failures":1,"waitMs":0,"savedAt":"now"}',
  ])('reads %p as no attempts', (text) => {
    expect(decodeAttempts(text)).toBeNull();
  });
});

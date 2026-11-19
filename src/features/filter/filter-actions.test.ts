import type { FilterStatus } from '@/domain/filter-state';
import {
  applyWeakening,
  enableFilter,
  turnYoutubeStrictOn,
} from '@/features/filter/filter-actions';
import type { FilterBridge } from '@/features/filter/filter-bridge';

const ON: FilterStatus = {
  available: true,
  consent: true,
  running: true,
  enabled: true,
  youtubeStrict: false,
  stopReason: null,
  strictPrivateDns: false,
  otherVpn: false,
};

function bridge(status: FilterStatus, overrides: Partial<FilterBridge> = {}) {
  return {
    status: () => status,
    requestConsent: jest.fn(async () => true),
    start: jest.fn(async () => true),
    stop: jest.fn(async () => undefined),
    resume: jest.fn(async () => true),
    measure: jest.fn(async () => null),
    ...overrides,
  };
}

describe('enableFilter', () => {
  it('starts at once when the consent holds', async () => {
    const fake = bridge({ ...ON, enabled: false, running: false });

    await expect(enableFilter(fake, true, false)).resolves.toBe('started');
    expect(fake.requestConsent).not.toHaveBeenCalled();
    expect(fake.start).toHaveBeenCalledWith({ youtubeStrict: true });
  });

  it('shows the disclosure before Android asks for consent', async () => {
    const fake = bridge({ ...ON, consent: false });

    await expect(enableFilter(fake, false, false)).resolves.toBe('needs-disclosure');
    expect(fake.requestConsent).not.toHaveBeenCalled();
    expect(fake.start).not.toHaveBeenCalled();
  });

  it('asks for consent once the disclosure is accepted', async () => {
    const fake = bridge({ ...ON, consent: false });

    await expect(enableFilter(fake, false, true)).resolves.toBe('started');
    expect(fake.requestConsent).toHaveBeenCalled();
  });

  it('starts nothing when the consent is refused', async () => {
    const fake = bridge({ ...ON, consent: false }, { requestConsent: jest.fn(async () => false) });

    await expect(enableFilter(fake, false, true)).resolves.toBe('refused');
    expect(fake.start).not.toHaveBeenCalled();
  });

  it('reports a filter that cannot start', async () => {
    await expect(enableFilter(bridge({ available: false }), false, true)).resolves.toBe('failed');
    await expect(
      enableFilter(bridge(ON, { start: jest.fn(async () => false) }), false, true),
    ).resolves.toBe('failed');
  });
});

describe('turnYoutubeStrictOn', () => {
  it('applies at once to a filter that is on', async () => {
    const fake = bridge(ON);

    await expect(turnYoutubeStrictOn(fake)).resolves.toBe(true);
    expect(fake.start).toHaveBeenCalledWith({ youtubeStrict: true });
  });

  it('does nothing while the filter is off', async () => {
    const fake = bridge({ ...ON, enabled: false });

    await expect(turnYoutubeStrictOn(fake)).resolves.toBe(false);
    expect(fake.start).not.toHaveBeenCalled();
  });
});

describe('applyWeakening', () => {
  it('turns the filter off', async () => {
    const fake = bridge(ON);

    await expect(applyWeakening(fake, 'filter')).resolves.toBe(true);
    expect(fake.stop).toHaveBeenCalled();
  });

  it('turns YouTube strict off on a filter that is on', async () => {
    const fake = bridge({ ...ON, youtubeStrict: true });

    await expect(applyWeakening(fake, 'youtube')).resolves.toBe(true);
    expect(fake.start).toHaveBeenCalledWith({ youtubeStrict: false });
  });

  it('leaves a filter that was turned off meanwhile alone', async () => {
    const fake = bridge({ ...ON, enabled: false });

    await expect(applyWeakening(fake, 'youtube')).resolves.toBe(false);
    expect(fake.start).not.toHaveBeenCalled();
  });
});

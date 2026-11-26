import { execFileSync } from 'node:child_process';
import path from 'node:path';

const fixtures = path.join(__dirname, '..', 'test', 'fixtures', 'xmltree');
const filterService = 'org.fnyxgroup.flust.filter.FilterVpnService';
const restartJob = 'org.fnyxgroup.flust.filter.FilterRestartJob';

// The fixtures are the `aapt2 dump xmltree` output of APKs built from small manifests with
// `aapt2 link`.
function attribute(fixture: string, service: string, name: string): string {
  return execFileSync(
    'awk',
    [
      '-v',
      `service=${service}`,
      '-v',
      `attribute=${name}`,
      '-f',
      path.join(__dirname, 'service-attribute.awk'),
      path.join(fixtures, `${fixture}.xmltree`),
    ],
    { encoding: 'utf8' },
  );
}

describe('service-attribute.awk', () => {
  it('reads a flag as aapt2 prints it and a string without its quotes', () => {
    expect(attribute('vpn-filter', filterService, 'foregroundServiceType')).toBe('0x00000400\n');
    expect(attribute('vpn-filter', restartJob, 'permission')).toBe(
      'android.permission.BIND_JOB_SERVICE\n',
    );
  });

  it('reads the attribute of the service named, not of another one', () => {
    expect(attribute('vpn-filter', filterService, 'permission')).toBe(
      'android.permission.BIND_VPN_SERVICE\n',
    );
    expect(attribute('filter-other-type', restartJob, 'foregroundServiceType')).toBe('');
  });

  it('prints nothing for a missing attribute or service', () => {
    expect(attribute('filter-no-type', filterService, 'foregroundServiceType')).toBe('');
    expect(attribute('filter-job-unprotected', restartJob, 'permission')).toBe('');
    expect(attribute('filter-no-job', restartJob, 'permission')).toBe('');
  });

  it('does not take an attribute of a child element for the service', () => {
    expect(attribute('vpn-filter', '.Worker', 'value')).toBe('');
  });
});

import { execFileSync } from 'node:child_process';
import path from 'node:path';

const fixtures = path.join(__dirname, '..', 'test', 'fixtures', 'xmltree');

// Each fixture is the `aapt2 dump xmltree` output of an APK built from a small manifest with
// `aapt2 link`. The vpn- fixtures also hold a job service that is not a VPN.
function servicesIn(fixture: string): string[] {
  const output = execFileSync(
    'awk',
    ['-f', path.join(__dirname, 'vpn-services.awk'), path.join(fixtures, `${fixture}.xmltree`)],
    { encoding: 'utf8' },
  );
  return output.split('\n').filter((line) => line !== '');
}

describe('vpn-services.awk', () => {
  it('finds nothing in a manifest without a VPN service', () => {
    expect(servicesIn('vpn-none')).toEqual([]);
    expect(servicesIn('clean')).toEqual([]);
  });

  it('finds the filter service', () => {
    expect(servicesIn('vpn-filter')).toEqual(['org.fnyxgroup.flust.filter.FilterVpnService']);
  });

  it('finds a VPN service by its action alone or by its permission alone', () => {
    expect(servicesIn('vpn-foreign')).toEqual([
      'org.fnyxgroup.flust.filter.FilterVpnService',
      'com.example.sdk.TunnelService',
      'com.example.sdk.ProxyService',
    ]);
  });
});

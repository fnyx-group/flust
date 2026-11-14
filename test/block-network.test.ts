import { blockNetwork, networkError } from './block-network';

function blockedTarget() {
  const target: Record<string, unknown> = {};
  return { target, network: blockNetwork(target) };
}

function call(api: unknown, asConstructor: boolean) {
  if (typeof api !== 'function') throw new TypeError('not a function');
  return asConstructor ? Reflect.construct(api, []) : Reflect.apply(api, undefined, []);
}

describe('blockNetwork', () => {
  it.each([
    ['fetch', false],
    ['XMLHttpRequest', true],
    ['WebSocket', true],
  ] as const)('makes %s throw', (api, asConstructor) => {
    const { target } = blockedTarget();
    expect(() => call(target[api], asConstructor)).toThrow(networkError(api));
  });

  it('records attempts, then forgets them', () => {
    const { target, network } = blockedTarget();
    expect(() => call(target.fetch, false)).toThrow();
    expect(network.takeAttempts()).toEqual(['fetch']);
    expect(network.takeAttempts()).toEqual([]);
  });

  it('cannot be replaced by a test', () => {
    const { target } = blockedTarget();
    expect(() => Object.assign(target, { fetch: () => undefined })).toThrow(TypeError);
  });
});

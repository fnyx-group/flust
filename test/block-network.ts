export const networkApis = ['fetch', 'XMLHttpRequest', 'WebSocket'] as const;

type NetworkApi = (typeof networkApis)[number];

export function networkError(api: NetworkApi): Error {
  return new Error(
    `${api} was called during a test. flust never uses the network, see docs/decisions/0006-no-network-access.md.`,
  );
}

// Every API throws, and attempts are also recorded so that a call wrapped in try/catch still fails the test.
export function blockNetwork(target: object) {
  let attempts: NetworkApi[] = [];

  for (const api of networkApis) {
    function blocked(): never {
      attempts.push(api);
      throw networkError(api);
    }
    Object.defineProperty(target, api, {
      value: blocked,
      writable: false,
      configurable: false,
    });
  }

  return {
    takeAttempts(): NetworkApi[] {
      const taken = attempts;
      attempts = [];
      return taken;
    },
  };
}

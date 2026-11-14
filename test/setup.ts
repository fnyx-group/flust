import { blockNetwork } from './block-network';

const network = blockNetwork(globalThis);

afterEach(() => {
  const attempts = network.takeAttempts();
  if (attempts.length > 0) {
    throw new Error(`Network access attempted during the test: ${attempts.join(', ')}.`);
  }
});

# Testing

## Tooling

Jest with the `jest-expo` preset, configured in `jest.config.js`. Run the suite with:

    pnpm test
    pnpm test:coverage   # with coverage thresholds, as in CI

CI runs it with coverage right after the typecheck. Network access fails any test, and `src/domain/` and `src/data/` have coverage thresholds: see [Conventions](conventions.md#tests).

## What to test

Tests target business logic and sensitive code:

- encryption and key handling,
- storage,
- streak calculation,
- date handling (time zones, day boundaries).

What not to test:

- snapshots,
- trivial renders (a component that only displays its props),
- third-party libraries.

Every fixed bug gets a test that reproduces it.

## Where

Test files live next to the code they test: `streak.ts` -> `streak.test.ts`.

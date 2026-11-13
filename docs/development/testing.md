# Testing

## Tooling

Jest with the `jest-expo` preset, configured in `package.json`. Run the suite with:

    pnpm test

CI runs it right after the typecheck.

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

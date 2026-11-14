# 0009 Source layers

## Context

Streak calculation, ranks and dates are the most sensitive logic in the app, and they must stay testable without React Native or Expo. Without a rule, screens tend to read storage directly and logic spreads into components, where it is hard to test and to review.

## Decision

`src/` is split into layers with a fixed import direction: `app` -> `features` -> `data` -> `domain`, with `ui` for shared components and `lib` for shared infrastructure. `domain` is pure TypeScript and depends on nothing else. `ui` may only import types from `domain`.

The rules are enforced by ESLint with `no-restricted-imports` on `@/` alias paths, rather than a resolver-based plugin, so they need no extra dependency. Parent-relative imports are forbidden in `src/` so that every cross-folder import goes through the alias and is checked.

The full table is in [Conventions](../development/conventions.md#layers).

## Consequences

- A wrong import fails lint and CI.
- `domain` and `data` can hold strict coverage thresholds because they contain logic only.
- Imports between folders are always written with `@/`, even for close neighbors.

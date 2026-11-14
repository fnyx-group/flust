# Conventions

## Code style

- TypeScript in strict mode, with `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch` and `noImplicitReturns`. Type errors are fixed, not silenced: no casts or non-null assertions unless there is no other way.
- Prettier formats everything: single quotes, trailing commas, 100 columns.
- ESLint uses `eslint-config-expo`, with `eslint-config-prettier` turning off formatting rules, plus the project rules below (`eslint.config.js`).
- Self-explanatory code. Comments are written in English and only explain a non-obvious reason (why, not what). No commented-out code, no banner comments, no emojis.
- Small, focused functions and files.

## Layers

Code in `src/` is split into layers. A layer may only import from the layers listed for it; ESLint fails on any other import.

| Layer           | Contains                                     | May import                    |
| --------------- | -------------------------------------------- | ----------------------------- |
| `src/domain/`   | Pure logic: streaks, ranks, dates            | nothing else in `src/`        |
| `src/data/`     | Storage                                      | `domain`, `lib`               |
| `src/features/` | Screens and hooks                            | `domain`, `data`, `ui`, `lib` |
| `src/ui/`       | Shared components and the theme              | types from `domain`           |
| `src/app/`      | Routes, kept thin: they delegate to features | `features`, `ui`, `lib`       |
| `src/lib/`      | Shared infrastructure, such as i18n setup    | nothing else in `src/`        |

- `src/domain/` must not depend on React, React Native, Expo or i18n packages, so it stays testable in isolation.
- `src/ui/` may use `import type` from `domain`, never runtime code.
- Imports between folders use the `@/` alias (`@/domain/streak`). Parent-relative imports (`../`) are forbidden in `src/`, because the layer check reads the import path and cannot see through them.
- Folders are created when the first code lands in them, never with placeholder files.

## Lint rules

- No hex color literals in `src/` outside `src/ui/theme.ts`. Use a color from the theme.
- No literal user-facing text in JSX outside tests: text children, string expressions, and attributes such as `accessibilityLabel`, `accessibilityHint`, `placeholder`, `title`, `label` and `alt`. All text goes through i18n with `t()`. Text made only of punctuation or spaces, such as a separator, is allowed.
- React hooks rules and the React Compiler rules from `eslint-plugin-react-hooks` (included by `eslint-config-expo`) are errors, including `exhaustive-deps`.

## React Compiler

The React Compiler is enabled by `experiments.reactCompiler` in `app.json`; `babel-preset-expo` applies it. Code must follow the Rules of React so that the compiler can memoize it, which the lint rules above check.

## Unused code

[knip](https://knip.dev) reports unused files, exports and dependencies (`pnpm knip`, configured in `knip.json`). Routes in `src/app/` are its entry points. `expo-updates` is ignored because knip assumes it for every Expo app, while flust has no over-the-air updates ([0006](../decisions/0006-no-network-access.md)).

## Tests

- `test/setup.ts` makes `fetch`, `XMLHttpRequest` and `WebSocket` throw, and fails the test even if the error is caught. Tests cannot replace these globals.
- `src/domain/` and `src/data/` must keep 90 percent line and branch coverage (`pnpm test:coverage`). Each threshold applies once its folder contains code. There is no global threshold.

See [Testing](testing.md) for what to test.

## Commits

- Conventional Commits. Allowed types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`, `security`.
- Imperative mood, English. Keep the header under 72 characters; commitlint enforces a hard limit of 100.
- One logical change per commit. All commits are signed.
- Messages must not contain emojis, `Co-Authored-By` trailers or tool attribution lines.

commitlint (`commitlint.config.mjs`) enforces these rules in the `commit-msg` hook and on pull request commits in CI.

## Git hooks

lefthook (`lefthook.yml`) runs on every commit:

- pre-commit: Prettier and ESLint on staged files plus a full typecheck, then gitleaks on staged changes.
- commit-msg: commitlint.

## Branches

- `main` is always releasable. No direct pushes.
- Work happens on short-lived branches named `<type>/<short-description>`, using the commit types above (for example `feat/journal-entry`, `fix/streak-timezone`).

## Pull requests

- One topic per pull request, targeting `main`.
- Pull requests are merged by squash only. The pull request title becomes the commit message on `main`, so it follows the commit rules above.
- CI must pass: typecheck, tests with coverage, lint, knip, format check, and commitlint on the commits and the pull request title.
- Architecture decisions come with a new file in `docs/decisions/`.

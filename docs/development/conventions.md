# Conventions

## Code style

- TypeScript in strict mode, with `noUncheckedIndexedAccess` and `noImplicitOverride`.
- Prettier formats everything: single quotes, trailing commas, 100 columns.
- ESLint uses `eslint-config-expo`, with `eslint-config-prettier` turning off formatting rules.
- Self-explanatory code. Comments are written in English and only explain a non-obvious reason (why, not what). No commented-out code, no banner comments, no emojis.
- Small, focused functions and files.

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
- CI must pass: typecheck, tests, lint, format check, and commitlint on the commits and the pull request title.
- Architecture decisions come with a new file in `docs/decisions/`.
